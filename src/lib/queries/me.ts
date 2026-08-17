import { prisma } from "@/lib/db";

// Deliberately not part of dal.ts::getCurrentUser's include — that query is
// react-cache'd but still runs its include on every single page in the app,
// not just /me. Reporting-manager name is only ever displayed on the profile
// card, so it gets its own narrow, /me-only query instead of a heavier
// global one.
export async function getMyManager(reportingToId: string | null) {
  if (!reportingToId) return null;
  return prisma.employee.findUnique({
    where: { id: reportingToId },
    select: { id: true, name: true },
  });
}

export async function getMyAttendance(employeeId: string) {
  return prisma.attendance.findMany({
    where: { employeeId },
    orderBy: { date: "desc" },
    take: 14,
  });
}

export async function getMyAttendanceToday(employeeId: string) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });
}

export async function getMySiteVisits(employeeId: string) {
  return prisma.siteVisit.findMany({
    where: { assignedToId: employeeId },
    orderBy: { scheduledDate: "asc" },
    include: { client: true, project: true, lead: true, attachments: true },
  });
}

export async function getMyLeaveRequests(employeeId: string) {
  return prisma.leaveRequest.findMany({
    where: { employeeId },
    orderBy: { appliedOn: "desc" },
    take: 10,
  });
}

export async function getMyTimesheets(employeeId: string) {
  return prisma.timesheet.findMany({
    where: { employeeId },
    orderBy: { date: "desc" },
    take: 10,
    include: { project: true },
  });
}

// "Manager" here means anyone with at least one direct report — matches the
// existing org-chart hierarchy (Employee.reportingTo) rather than a new role.
export async function getIsManager(employeeId: string) {
  const count = await prisma.employee.count({
    where: { reportingToId: employeeId, deletedAt: null },
  });
  return count > 0;
}

export async function getMyDailySummaries(employeeId: string) {
  return prisma.dailySummary.findMany({
    where: { employeeId },
    orderBy: { date: "desc" },
    take: 10,
  });
}

export async function getTodaysSummary(employeeId: string) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return prisma.dailySummary.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });
}

export async function getTeamDailySummaries(managerEmployeeId: string) {
  return prisma.dailySummary.findMany({
    where: { employee: { reportingToId: managerEmployeeId } },
    orderBy: { date: "desc" },
    take: 20,
    include: { employee: { select: { id: true, name: true } } },
  });
}

export async function getProjectOptions(organizationId: string) {
  return prisma.project.findMany({
    where: { client: { organizationId } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
