"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import type { FormActionState } from "@/lib/actions/crm";

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

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "");

  if (!title) {
    return { error: "Give the task a title." };
  }

  await prisma.personalTask.create({
    data: {
      employeeId: user.employeeId,
      title,
      description: description || null,
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
  await prisma.personalTask.update({ where: { id: taskId }, data: { status } });
  revalidatePath("/me");
}

export async function deleteTask(taskId: string) {
  const user = await getCurrentUser();
  const task = await prisma.personalTask.findUnique({ where: { id: taskId } });
  if (!task || task.employeeId !== user.employeeId) {
    throw new Error("Not authorized to delete this task");
  }
  await prisma.personalTask.delete({ where: { id: taskId } });
  revalidatePath("/me");
}

export async function logTimesheet(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const user = await getCurrentUser();
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
