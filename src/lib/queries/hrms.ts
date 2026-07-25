import { prisma } from "@/lib/db";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getHrmsOverview(organizationId: string) {
  const today = startOfToday();
  const now = new Date();

  const [
    totalActive,
    attendanceToday,
    pendingLeave,
    onLeaveToday,
    pendingPayroll,
    recentLeaveRequests,
    departmentCounts,
  ] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE", organizationId } }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: { date: today, employee: { organizationId } },
      _count: true,
    }),
    prisma.leaveRequest.count({ where: { status: "PENDING", employee: { organizationId } } }),
    prisma.attendance.count({ where: { date: today, status: "ON_LEAVE", employee: { organizationId } } }),
    prisma.payrollRecord.count({
      where: {
        status: "PENDING",
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        employee: { organizationId },
      },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "PENDING", employee: { organizationId } },
      orderBy: { appliedOn: "desc" },
      take: 6,
      include: { employee: true },
    }),
    prisma.employee.groupBy({ by: ["department"], _count: true, where: { status: "ACTIVE", organizationId } }),
  ]);

  return {
    totalActive,
    attendanceToday,
    pendingLeave,
    onLeaveToday,
    pendingPayroll,
    recentLeaveRequests,
    departmentCounts,
  };
}

export async function getEmployees(organizationId: string) {
  return prisma.employee.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { timesheets: true, leaveRequests: true } },
    },
  });
}

export async function getEmployeeDetail(id: string, organizationId: string) {
  return prisma.employee.findFirst({
    where: { id, organizationId },
    include: {
      attendances: { orderBy: { date: "desc" }, take: 21 },
      leaveRequests: { orderBy: { appliedOn: "desc" }, take: 10 },
      payrollRecords: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 6 },
      timesheets: { orderBy: { date: "desc" }, take: 10, include: { project: true } },
      reportingTo: true,
      documents: { orderBy: { createdAt: "desc" }, include: { uploadedBy: true } },
    },
  });
}

export async function getOrgChart(organizationId: string) {
  return prisma.employee.findMany({
    where: { status: "ACTIVE", organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      department: true,
      reportingToId: true,
    },
  });
}

export async function getAttendanceToday(organizationId: string) {
  const today = startOfToday();
  return prisma.attendance.findMany({
    where: { date: today, employee: { organizationId } },
    include: { employee: true },
    orderBy: { employee: { name: "asc" } },
  });
}

export async function getLeaveRequests(organizationId: string) {
  return prisma.leaveRequest.findMany({
    where: { employee: { organizationId } },
    orderBy: { appliedOn: "desc" },
    include: { employee: true },
  });
}

export async function getPayrollRecords(organizationId: string) {
  return prisma.payrollRecord.findMany({
    where: { employee: { organizationId } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { employee: true },
  });
}

export async function getTimesheets(organizationId: string) {
  return prisma.timesheet.findMany({
    where: { employee: { organizationId } },
    orderBy: { date: "desc" },
    take: 100,
    include: { employee: true, project: { include: { client: true } } },
  });
}
