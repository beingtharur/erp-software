"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { notifyEmployee, notifyRole } from "@/lib/notify";
import { titleCase } from "@/lib/format";
import type { FormActionState } from "@/lib/actions/crm";

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function checkInAttendance() {
  const user = await getCurrentUser();
  if (!user.employeeId) {
    throw new Error("No employee record linked to this account.");
  }
  const date = todayMidnight();

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: user.employeeId, date } },
  });
  if (existing?.checkIn) {
    throw new Error("Already checked in today.");
  }

  const checkIn = new Date();
  if (existing) {
    await prisma.attendance.update({
      where: { id: existing.id },
      data: { checkIn, status: "PRESENT" },
    });
  } else {
    await prisma.attendance.create({
      data: { employeeId: user.employeeId, date, checkIn, status: "PRESENT", hoursWorked: 0 },
    });
  }

  revalidatePath("/me");
  revalidatePath("/hrms/attendance");
  revalidatePath("/");
}

export async function checkOutAttendance() {
  const user = await getCurrentUser();
  if (!user.employeeId) {
    throw new Error("No employee record linked to this account.");
  }
  const date = todayMidnight();

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: user.employeeId, date } },
  });
  if (!existing?.checkIn) {
    throw new Error("You haven't checked in today.");
  }
  if (existing.checkOut) {
    throw new Error("Already checked out today.");
  }

  const checkOut = new Date();
  const hoursWorked = Number(((checkOut.getTime() - existing.checkIn.getTime()) / 3600000).toFixed(1));
  const status = hoursWorked < 4 ? "HALF_DAY" : "PRESENT";

  await prisma.attendance.update({
    where: { id: existing.id },
    data: { checkOut, hoursWorked, status },
  });

  revalidatePath("/me");
  revalidatePath("/hrms/attendance");
  revalidatePath("/");
}

const HALF_DAY_PERIODS = new Set(["FIRST_HALF", "SECOND_HALF", "CUSTOM"]);

export async function applyLeave(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const user = await getCurrentUser();
  if (!user.employeeId) {
    return { error: "No employee record linked to this account." };
  }

  const type = String(formData.get("type") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!type || !startDate || !reason) {
    return { error: "Please fill in all fields." };
  }

  const start = new Date(startDate);
  const isHalfDay = type === "HALF_DAY";

  let end = start;
  let days: number;
  let halfDayPeriod: string | null = null;
  let halfDayStartTime: string | null = null;
  let halfDayEndTime: string | null = null;

  if (isHalfDay) {
    // A half-day request is always a single day — end date and day count are
    // derived server-side, never trusted from the client.
    halfDayPeriod = String(formData.get("halfDayPeriod") ?? "");
    if (!HALF_DAY_PERIODS.has(halfDayPeriod)) {
      return { error: "Select a half-day period." };
    }
    if (halfDayPeriod === "CUSTOM") {
      halfDayStartTime = String(formData.get("halfDayStartTime") ?? "");
      halfDayEndTime = String(formData.get("halfDayEndTime") ?? "");
      if (!halfDayStartTime || !halfDayEndTime) {
        return { error: "Enter a start and end time for your custom half-day." };
      }
      if (halfDayStartTime >= halfDayEndTime) {
        return { error: "End time must be after start time." };
      }
    }
    days = 0.5;
  } else {
    const endDate = String(formData.get("endDate") ?? "");
    if (!endDate) {
      return { error: "Please fill in all fields." };
    }
    end = new Date(endDate);
    if (end < start) {
      return { error: "End date must be after start date." };
    }
    days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  }

  await prisma.leaveRequest.create({
    data: {
      employeeId: user.employeeId,
      type: type as never,
      startDate: start,
      endDate: end,
      days,
      reason,
      status: "PENDING",
      halfDayPeriod: halfDayPeriod as never,
      halfDayStartTime,
      halfDayEndTime,
    },
  });

  // Previously HR/Admin only discovered a pending leave request by visiting
  // /hrms/leave — every other approval-style flow (expense claims, budgets,
  // POs) notifies the deciding role at submission time. Match that here.
  // Half-day requests additionally notify ADMIN (not just HR), matching the
  // client's explicit "Managers/Admins/HR should be able to Approve/Reject."
  const employee = await prisma.employee.findUnique({ where: { id: user.employeeId } });
  if (employee) {
    const label = isHalfDay ? `Half-Day (${titleCase(halfDayPeriod!)})` : `${titleCase(type)} leave`;
    const message = `${employee.name} applied for ${label} (${days} day${days === 1 ? "" : "s"}).`;
    await notifyRole("HR", employee.organizationId, message, "/hrms/leave");
    if (isHalfDay) {
      await notifyRole("ADMIN", employee.organizationId, message, "/hrms/leave");
    }
  }

  revalidatePath("/me");
  revalidatePath("/hrms/leave");
  revalidatePath("/hrms");
  return { success: true };
}


export async function submitDailySummary(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const user = await getCurrentUser();
  if (!user.employeeId) {
    return { error: "No employee record linked to this account." };
  }

  const date = todayMidnight();
  const fields = {
    completedNote: String(formData.get("completedNote") ?? "").trim() || null,
    inProgressNote: String(formData.get("inProgressNote") ?? "").trim() || null,
    pendingNote: String(formData.get("pendingNote") ?? "").trim() || null,
    blockersNote: String(formData.get("blockersNote") ?? "").trim() || null,
    updatesNote: String(formData.get("updatesNote") ?? "").trim() || null,
    nextDayPlan: String(formData.get("nextDayPlan") ?? "").trim() || null,
  };

  if (Object.values(fields).every((v) => !v)) {
    return { error: "Add at least one note before submitting." };
  }

  await prisma.dailySummary.upsert({
    where: { employeeId_date: { employeeId: user.employeeId, date } },
    create: { employeeId: user.employeeId, date, ...fields },
    update: fields,
  });

  revalidatePath("/me");
  return { success: true };
}

export async function logTimesheet(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  if (!user.employeeId) {
    return { error: "No employee record linked to this account." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  const date = String(formData.get("date") ?? "");
  const hoursLogged = Number(formData.get("hoursLogged"));
  const taskDescription = String(formData.get("taskDescription") ?? "").trim();
  // Previously hardcoded to true with no UI control — billable is now a real
  // checkbox on the form (checkboxes only appear in FormData when checked).
  const billable = formData.get("billable") === "on";

  if (!date || !taskDescription || !Number.isFinite(hoursLogged) || hoursLogged <= 0) {
    return { error: "Please fill in all fields with a valid number of hours." };
  }

  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, client: { organizationId } } });
    if (!project) {
      return { error: "Project not found." };
    }
  }

  await prisma.timesheet.create({
    data: {
      employeeId: user.employeeId,
      projectId: projectId || null,
      date: new Date(date),
      hoursLogged,
      taskDescription,
      billable,
    },
  });

  revalidatePath("/me");
  revalidatePath("/hrms/timesheets");
  return { success: true };
}
