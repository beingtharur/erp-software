import { prisma } from "@/lib/db";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getHrmsOverview() {
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
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.attendance.groupBy({ by: ["status"], where: { date: today }, _count: true }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.attendance.count({ where: { date: today, status: "ON_LEAVE" } }),
    prisma.payrollRecord.count({
      where: { status: "PENDING", month: now.getMonth() + 1, year: now.getFullYear() },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { appliedOn: "desc" },
      take: 6,
      include: { employee: true },
    }),
    prisma.employee.groupBy({ by: ["department"], _count: true, where: { status: "ACTIVE" } }),
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

export async function getEmployees() {
  return prisma.employee.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { timesheets: true, leaveRequests: true } },
    },
  });
}

export async function getEmployeeDetail(id: string) {
  return prisma.employee.findUnique({
    where: { id },
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

export async function getOrgChart() {
  return prisma.employee.findMany({
    where: { status: "ACTIVE" },
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

export async function getAttendanceToday() {
  const today = startOfToday();
  return prisma.attendance.findMany({
    where: { date: today },
    include: { employee: true },
    orderBy: { employee: { name: "asc" } },
  });
}

export async function getLeaveRequests() {
  return prisma.leaveRequest.findMany({
    orderBy: { appliedOn: "desc" },
    include: { employee: true },
  });
}

export async function getPayrollRecords() {
  return prisma.payrollRecord.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { employee: true },
  });
}

export async function getTimesheets() {
  return prisma.timesheet.findMany({
    orderBy: { date: "desc" },
    take: 100,
    include: { employee: true, project: { include: { client: true } } },
  });
}
