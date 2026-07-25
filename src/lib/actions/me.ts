"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
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
  const endDate = String(formData.get("endDate") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!type || !startDate || !endDate || !reason) {
    return { error: "Please fill in all fields." };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) {
    return { error: "End date must be after start date." };
  }
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  await prisma.leaveRequest.create({
    data: {
      employeeId: user.employeeId,
      type: type as never,
      startDate: start,
      endDate: end,
      days,
      reason,
      status: "PENDING",
    },
  });

  revalidatePath("/me");
  revalidatePath("/hrms/leave");
  revalidatePath("/hrms");
  return { success: true };
}

export async function createTask(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const user = await getCurrentUser();
  if (!user.employeeId) {
    return { error: "No employee record linked to this account." };
  }
  const organizationId = user.organizationId!;

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "");
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const assigneeIdRaw = String(formData.get("assigneeId") ?? "");

  if (!title) {
    return { error: "Give the task a title." };
  }

  let employeeId = user.employeeId;
  let assignedById: string | null = null;

  if (assigneeIdRaw && assigneeIdRaw !== user.employeeId) {
    // Anyone with at least one direct report can assign across the org — this
    // reuses the existing reportingTo hierarchy rather than a new permission model.
    const directReportCount = await prisma.employee.count({
      where: { reportingToId: user.employeeId },
    });
    if (directReportCount === 0) {
      return { error: "Only managers can assign tasks to other employees." };
    }
    const assignee = await prisma.employee.findFirst({ where: { id: assigneeIdRaw, organizationId } });
    if (!assignee) {
      return { error: "Assignee not found." };
    }
    employeeId = assignee.id;
    assignedById = user.employeeId;
  }

  await prisma.personalTask.create({
    data: {
      employeeId,
      assignedById,
      title,
      description: description || null,
      priority: priority as never,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  revalidatePath("/me");
  return { success: true };
}

export async function updateTaskStatus(taskId: string, status: "TODO" | "IN_PROGRESS" | "DONE") {
  const user = await getCurrentUser();
  const task = await prisma.personalTask.findUnique({ where: { id: taskId } });
  if (!task || task.employeeId !== user.employeeId) {
    throw new Error("Not authorized to update this task");
  }
  await prisma.personalTask.update({
    where: { id: taskId },
    data: { status, isBlocked: status === "DONE" ? false : task.isBlocked },
  });
  revalidatePath("/me");
}

export async function deleteTask(taskId: string) {
  const user = await getCurrentUser();
  const task = await prisma.personalTask.findUnique({ where: { id: taskId } });
  if (!task || (task.employeeId !== user.employeeId && task.assignedById !== user.employeeId)) {
    throw new Error("Not authorized to delete this task");
  }
  await prisma.personalTask.delete({ where: { id: taskId } });
  revalidatePath("/me");
}

export async function setTaskBlocked(taskId: string, isBlocked: boolean, blockerNote: string) {
  const user = await getCurrentUser();
  const task = await prisma.personalTask.findUnique({ where: { id: taskId } });
  if (!task || task.employeeId !== user.employeeId) {
    throw new Error("Not authorized to update this task");
  }
  await prisma.personalTask.update({
    where: { id: taskId },
    data: { isBlocked, blockerNote: isBlocked ? blockerNote.trim() || null : null },
  });
  revalidatePath("/me");
}

export async function addTaskComment(taskId: string, body: string) {
  const user = await getCurrentUser();
  if (!user.employeeId) {
    throw new Error("No employee record linked to this account.");
  }
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Comment can't be empty.");
  }

  const task = await prisma.personalTask.findFirst({
    where: { id: taskId, employee: { organizationId: user.organizationId! } },
  });
  if (!task || (task.employeeId !== user.employeeId && task.assignedById !== user.employeeId)) {
    throw new Error("Not authorized to comment on this task");
  }

  await prisma.taskComment.create({
    data: { taskId, authorId: user.employeeId, body: trimmed },
  });
  revalidatePath("/me");
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
      billable: true,
    },
  });

  revalidatePath("/me");
  revalidatePath("/hrms/timesheets");
  return { success: true };
}
