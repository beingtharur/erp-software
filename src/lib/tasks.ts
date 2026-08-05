import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { AccessRole } from "@/generated/prisma/client";

/**
 * One task system, several front doors. `PersonalTask` started life as the
 * personal board on /me; it is now also the HRMS Tasks console and the Tasks
 * section on an employee's profile. Rather than let each surface invent its own
 * rules, every task action resolves permission through the matrix below.
 *
 * The roles that matter for a task:
 *   - assignee   (`employeeId`)   — the person who has to do it
 *   - assigner   (`assignedById`) — the manager/HR who handed it over
 *   - task administrator          — ADMIN or HR, who run task management for
 *                                   the whole organization from HRMS
 */

export type TaskActor = {
  accessRole: AccessRole;
  employeeId: string | null;
};

export type TaskSubject = {
  employeeId: string;
  assignedById: string | null;
};

/** ADMIN and HR administer tasks org-wide — this is what /hrms/tasks is for. */
export function isTaskAdministrator(accessRole: AccessRole) {
  return accessRole === "ADMIN" || accessRole === "HR";
}

export function isTaskAssignee(actor: TaskActor, task: TaskSubject) {
  return actor.employeeId !== null && task.employeeId === actor.employeeId;
}

export function isTaskAssigner(actor: TaskActor, task: TaskSubject) {
  return actor.employeeId !== null && task.assignedById === actor.employeeId;
}

/** Who may open a task and read its comment thread. */
export function canViewTask(actor: TaskActor, task: TaskSubject) {
  return (
    isTaskAdministrator(actor.accessRole) || isTaskAssignee(actor, task) || isTaskAssigner(actor, task)
  );
}

/** Who may change the task itself — title, notes, priority, due date, assignee. */
export function canEditTask(actor: TaskActor, task: TaskSubject) {
  return isTaskAdministrator(actor.accessRole) || isTaskAssigner(actor, task);
}

/**
 * Status was previously assignee-only. HR/ADMIN and the assigner can now move it
 * too — they need to close out or re-open work during handovers and exits — but
 * the assignee keeps the same control they always had.
 */
export function canChangeTaskStatus(actor: TaskActor, task: TaskSubject) {
  return isTaskAssignee(actor, task) || canEditTask(actor, task);
}

export function canCommentOnTask(actor: TaskActor, task: TaskSubject) {
  return canViewTask(actor, task);
}

export function canDeleteTask(actor: TaskActor, task: TaskSubject) {
  return isTaskAssignee(actor, task) || canEditTask(actor, task);
}

/**
 * Reporting or clearing a blocker stays assignee-only: it is the assignee's own
 * status report about their work, not something a manager should put words in.
 */
export function canSetTaskBlocked(actor: TaskActor, task: TaskSubject) {
  return isTaskAssignee(actor, task);
}

/**
 * Who may hand a task to someone else. "Manager" is not a stored role anywhere
 * in this app — it means having at least one direct report in the org chart
 * (Employee.reportingTo), which is the same test the rest of the app uses.
 * ADMIN and HR bypass it because they administer tasks for everyone.
 */
export async function canAssignTasksToOthers(actor: TaskActor) {
  if (isTaskAdministrator(actor.accessRole)) return true;
  if (!actor.employeeId) return false;
  const directReports = await prisma.employee.count({
    where: { reportingToId: actor.employeeId, deletedAt: null },
  });
  return directReports > 0;
}

/**
 * PersonalTask carries no organizationId — it inherits the tenant through its
 * assignee. Every mutation must therefore load the task through the employee
 * relation, or an administrator of one organization could reach another's
 * tasks by id. (The original actions used a bare findUnique, which was only
 * safe while the rules were "assignee themselves".)
 */
export async function loadTaskInOrg(taskId: string, organizationId: string) {
  return prisma.personalTask.findFirst({
    where: { id: taskId, employee: { organizationId } },
  });
}

/**
 * Every surface a task shows up on. Kept in one place so a new task view can't
 * be forgotten by one action and refreshed by another.
 */
export function revalidateTaskSurfaces(employeeIds: (string | null | undefined)[] = []) {
  revalidatePath("/me");
  revalidatePath("/me/tasks");
  revalidatePath("/hrms/tasks");
  // Task KPIs live on the HRMS overview.
  revalidatePath("/hrms");
  for (const id of new Set(employeeIds.filter(Boolean) as string[])) {
    revalidatePath(`/hrms/employees/${id}`);
  }
}
