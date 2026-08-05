import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Every read of PersonalTask lives here — the personal board on /me, the HRMS
// Tasks console, the employee profile section and the HRMS overview KPIs all
// come from these functions rather than each page assembling its own query.

const withAssignmentContext = {
  employee: { select: { id: true, name: true, department: true } },
  assignedBy: { select: { id: true, name: true } },
  comments: {
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } },
  },
} satisfies Prisma.PersonalTaskInclude;

/** Tasks assigned *to* one employee — their own board. */
export async function getMyTasks(employeeId: string) {
  return prisma.personalTask.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    include: withAssignmentContext,
  });
}

/** Tasks one employee has handed to other people. */
export async function getTasksAssignedByMe(employeeId: string) {
  return prisma.personalTask.findMany({
    where: { assignedById: employeeId },
    orderBy: { createdAt: "desc" },
    include: withAssignmentContext,
  });
}

export type TaskFilters = {
  employeeId?: string;
  status?: string;
  priority?: string;
  /** "overdue" | "today" | "week" | "none" — matches the HRMS filter bar. */
  due?: string;
  search?: string;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Turns the HRMS filter bar into a Prisma where-clause. Kept separate from the
 * queries so the list and the stats agree on what "overdue" means.
 */
function buildTaskWhere(organizationId: string, filters: TaskFilters): Prisma.PersonalTaskWhereInput {
  const where: Prisma.PersonalTaskWhereInput = {
    // PersonalTask has no organizationId of its own — it is scoped through the
    // assignee, which is the tenant boundary for every task read.
    employee: { organizationId, deletedAt: null },
  };

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status as Prisma.PersonalTaskWhereInput["status"];
  }
  if (filters.priority && filters.priority !== "ALL") {
    where.priority = filters.priority as Prisma.PersonalTaskWhereInput["priority"];
  }

  const today = startOfToday();
  if (filters.due === "overdue") {
    // "Overdue" deliberately excludes DONE — a task finished after its due date
    // is late history, not outstanding work.
    where.dueDate = { lt: today };
    where.status = { not: "DONE" };
  } else if (filters.due === "today") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    where.dueDate = { gte: today, lt: tomorrow };
  } else if (filters.due === "week") {
    const weekOut = new Date(today);
    weekOut.setDate(weekOut.getDate() + 7);
    where.dueDate = { gte: today, lt: weekOut };
  } else if (filters.due === "none") {
    where.dueDate = null;
  }

  const search = filters.search?.trim();
  if (search) {
    // SQLite has no case-insensitive `mode` support in Prisma, so this is a
    // substring match on the stored casing — same behaviour as the rest of the
    // app's text lookups.
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { employee: { name: { contains: search }, organizationId, deletedAt: null } },
    ];
  }

  return where;
}

/** Every task in the organization, filtered — the HRMS Tasks console list. */
export async function getOrgTasks(organizationId: string, filters: TaskFilters = {}) {
  return prisma.personalTask.findMany({
    where: buildTaskWhere(organizationId, filters),
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: withAssignmentContext,
  });
}

/**
 * Task KPIs for the HRMS overview and the Tasks console header. One pass over
 * the same tenant scope the list uses, so the numbers and the rows agree.
 */
export async function getTaskStats(organizationId: string) {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const scope = { employee: { organizationId, deletedAt: null } } satisfies Prisma.PersonalTaskWhereInput;

  const [total, pending, overdue, completedToday] = await Promise.all([
    prisma.personalTask.count({ where: scope }),
    prisma.personalTask.count({ where: { ...scope, status: { not: "DONE" } } }),
    prisma.personalTask.count({
      where: { ...scope, status: { not: "DONE" }, dueDate: { lt: today } },
    }),
    prisma.personalTask.count({
      where: { ...scope, status: "DONE", updatedAt: { gte: today, lt: tomorrow } },
    }),
  ]);

  return { total, pending, overdue, completedToday };
}

/**
 * One employee's task picture for their HRMS profile: the same four numbers the
 * org-wide KPIs use, plus the most recent tasks themselves.
 */
export async function getEmployeeTaskSummary(employeeId: string) {
  const today = startOfToday();

  const [tasks, total, completed, pending, overdue] = await Promise.all([
    prisma.personalTask.findMany({
      where: { employeeId },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 8,
      include: { assignedBy: { select: { id: true, name: true } } },
    }),
    prisma.personalTask.count({ where: { employeeId } }),
    prisma.personalTask.count({ where: { employeeId, status: "DONE" } }),
    prisma.personalTask.count({ where: { employeeId, status: { not: "DONE" } } }),
    prisma.personalTask.count({
      where: { employeeId, status: { not: "DONE" }, dueDate: { lt: today } },
    }),
  ]);

  return { tasks, total, completed, pending, overdue };
}
