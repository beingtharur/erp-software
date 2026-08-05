"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { notifyEmployee } from "@/lib/notify";
import {
  canAssignTasksToOthers,
  canChangeTaskStatus,
  canCommentOnTask,
  canDeleteTask,
  canEditTask,
  canSetTaskBlocked,
  loadTaskInOrg,
  revalidateTaskSurfaces,
} from "@/lib/tasks";
import type { FormActionState } from "@/lib/actions/crm";

// The single home for every PersonalTask mutation. These began on /me as a
// personal board and are now equally the HRMS Tasks console — same model, same
// actions, same notifications; only the permission checks were widened (see
// lib/tasks.ts) so ADMIN/HR can administer tasks for the whole organization.

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
    if (!(await canAssignTasksToOthers(user))) {
      return { error: "Only managers, HR and admins can assign tasks to other employees." };
    }
    const assignee = await prisma.employee.findFirst({
      where: { id: assigneeIdRaw, organizationId, deletedAt: null },
    });
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

  // Only for delegated tasks — a self-created task doesn't need a notification
  // telling you about the thing you just typed.
  if (assignedById) {
    await notifyEmployee(
      employeeId,
      `${user.employee?.name ?? "Your manager"} assigned you a task: ${title}`,
      "/me/tasks"
    );
  }

  revalidateTaskSurfaces([employeeId]);
  return { success: true };
}

/**
 * Edit and reassign — the capability HRMS task management needed and the
 * personal board never had. Restricted to whoever may edit the task (the
 * assigner, or ADMIN/HR).
 */
export async function updateTask(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const user = await getCurrentUser();
  if (!user.employeeId) {
    return { error: "No employee record linked to this account." };
  }
  const organizationId = user.organizationId!;

  const taskId = String(formData.get("taskId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "");
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const assigneeIdRaw = String(formData.get("assigneeId") ?? "");

  if (!taskId || !title) {
    return { error: "Give the task a title." };
  }

  const task = await loadTaskInOrg(taskId, organizationId);
  if (!task) {
    return { error: "Task not found." };
  }
  if (!canEditTask(user, task)) {
    return { error: "You don't have permission to edit this task." };
  }

  let employeeId = task.employeeId;
  if (assigneeIdRaw && assigneeIdRaw !== task.employeeId) {
    if (!(await canAssignTasksToOthers(user))) {
      return { error: "Only managers, HR and admins can reassign tasks." };
    }
    const assignee = await prisma.employee.findFirst({
      where: { id: assigneeIdRaw, organizationId, deletedAt: null },
    });
    if (!assignee) {
      return { error: "Assignee not found." };
    }
    employeeId = assignee.id;
  }

  await prisma.personalTask.update({
    where: { id: taskId },
    data: {
      title,
      description: description || null,
      priority: priority as never,
      dueDate: dueDate ? new Date(dueDate) : null,
      employeeId,
      // A reassigned task is now owned by whoever moved it, so the new assignee
      // has someone to talk to about it.
      ...(employeeId !== task.employeeId ? { assignedById: user.employeeId } : {}),
    },
  });

  if (employeeId !== task.employeeId) {
    await notifyEmployee(
      employeeId,
      `${user.employee?.name ?? "Your manager"} assigned you a task: ${title}`,
      "/me/tasks"
    );
  }

  revalidateTaskSurfaces([employeeId, task.employeeId]);
  return { success: true };
}

export async function updateTaskStatus(taskId: string, status: "TODO" | "IN_PROGRESS" | "DONE") {
  const user = await getCurrentUser();
  const task = await loadTaskInOrg(taskId, user.organizationId!);
  if (!task || !canChangeTaskStatus(user, task)) {
    throw new Error("Not authorized to update this task");
  }
  await prisma.personalTask.update({
    where: { id: taskId },
    data: { status, isBlocked: status === "DONE" ? false : task.isBlocked },
  });

  // Tell the manager who handed the task over when it lands, so they don't have
  // to poll the board. Skipped when they moved it themselves.
  if (status === "DONE" && task.assignedById && task.assignedById !== user.employeeId) {
    await notifyEmployee(
      task.assignedById,
      `${user.employee?.name ?? "An employee"} completed the task: ${task.title}`,
      "/hrms/tasks"
    );
  }

  revalidateTaskSurfaces([task.employeeId]);
}

export async function deleteTask(taskId: string) {
  const user = await getCurrentUser();
  const task = await loadTaskInOrg(taskId, user.organizationId!);
  if (!task || !canDeleteTask(user, task)) {
    throw new Error("Not authorized to delete this task");
  }
  await prisma.taskComment.deleteMany({ where: { taskId } });
  await prisma.personalTask.delete({ where: { id: taskId } });
  revalidateTaskSurfaces([task.employeeId]);
}

export async function setTaskBlocked(taskId: string, isBlocked: boolean, blockerNote: string) {
  const user = await getCurrentUser();
  const task = await loadTaskInOrg(taskId, user.organizationId!);
  if (!task || !canSetTaskBlocked(user, task)) {
    throw new Error("Not authorized to update this task");
  }
  await prisma.personalTask.update({
    where: { id: taskId },
    data: { isBlocked, blockerNote: isBlocked ? blockerNote.trim() || null : null },
  });

  if (isBlocked && task.assignedById) {
    await notifyEmployee(
      task.assignedById,
      `${user.employee?.name ?? "An employee"} reported a blocker on: ${task.title}`,
      "/hrms/tasks"
    );
  }

  revalidateTaskSurfaces([task.employeeId]);
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

  const task = await loadTaskInOrg(taskId, user.organizationId!);
  if (!task || !canCommentOnTask(user, task)) {
    throw new Error("Not authorized to comment on this task");
  }

  await prisma.taskComment.create({
    data: { taskId, authorId: user.employeeId, body: trimmed },
  });
  revalidateTaskSurfaces([task.employeeId]);
}
