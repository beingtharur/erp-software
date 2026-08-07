import { prisma } from "@/lib/db";
import { getTaskStats } from "@/lib/queries/tasks";
import { getDepartmentHeadcount } from "@/lib/queries/departments";

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
    departmentHeadcount,
    taskStats,
  ] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE", organizationId, deletedAt: null } }),
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
    // Headcount now comes from the Department master list rather than a
    // groupBy over free text, so departments with nobody in them still show
    // (a zero-headcount department is information, not an absence).
    getDepartmentHeadcount(organizationId),
    // Reuses the same counts the Tasks console header shows, so the two views
    // can never disagree about what "overdue" or "completed today" means.
    getTaskStats(organizationId),
  ]);

  return {
    totalActive,
    attendanceToday,
    pendingLeave,
    onLeaveToday,
    pendingPayroll,
    recentLeaveRequests,
    departmentHeadcount,
    taskStats,
  };
}

export async function getEmployees(organizationId: string) {
  return prisma.employee.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { timesheets: true, leaveRequests: true } },
      department: { select: { id: true, name: true } },
      // The row menu offers "Set up salary" or "Update salary structure"
      // depending on whether one exists, and prefills the form from it.
      salaryStructures: { where: { isActive: true }, take: 1 },
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
      department: { select: { id: true, name: true } },
      documents: { orderBy: { createdAt: "desc" }, include: { uploadedBy: true } },
      salaryStructures: { orderBy: { effectiveFrom: "desc" }, take: 6 },
    },
  });
}

export async function getActiveSalaryStructure(employeeId: string) {
  return prisma.salaryStructure.findFirst({
    where: { employeeId, isActive: true },
  });
}

export async function getSalaryStructureHistory(employeeId: string) {
  return prisma.salaryStructure.findMany({
    where: { employeeId },
    orderBy: { effectiveFrom: "desc" },
    take: 12,
  });
}

export async function getOrgChart(organizationId: string) {
  return prisma.employee.findMany({
    where: { status: "ACTIVE", organizationId, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      department: { select: { id: true, name: true } },
      reportingToId: true,
    },
  });
}

// A full daily roster, not just the Attendance rows that happen to exist for
// today: an ACTIVE employee with no Attendance row and no approved leave
// covering today hasn't checked in at all (12:00 AM–11:59 PM) and would
// otherwise be silently missing from the list instead of showing as absent.
export async function getAttendanceToday(organizationId: string) {
  const today = startOfToday();

  const [employees, records, approvedLeaveToday] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE", organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { department: { select: { id: true, name: true } } },
    }),
    prisma.attendance.findMany({
      where: { date: today, employee: { organizationId } },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
        employee: { organizationId },
      },
    }),
  ]);

  const recordByEmployee = new Map(records.map((r) => [r.employeeId, r]));
  const leaveByEmployee = new Map(approvedLeaveToday.map((l) => [l.employeeId, l]));

  return employees.map((employee) => {
    const record = recordByEmployee.get(employee.id);
    if (record) {
      return { ...record, employee, leaveType: null };
    }
    const leave = leaveByEmployee.get(employee.id);
    if (leave) {
      return {
        id: `leave-${leave.id}`,
        employee,
        checkIn: null,
        checkOut: null,
        hoursWorked: 0,
        status: "ON_LEAVE" as const,
        leaveType: leave.type,
      };
    }
    return {
      id: `absent-${employee.id}`,
      employee,
      checkIn: null,
      checkOut: null,
      hoursWorked: 0,
      status: "ABSENT" as const,
      leaveType: null,
    };
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
    include: {
      employee: {
        include: {
          // Tells the row's salary button whether to say "Set up Salary" (never
          // configured — a past PayrollRecord can exist from before a structure
          // was required, e.g. seed data) or "Change Salary Structure".
          salaryStructures: { where: { isActive: true }, take: 1 },
        },
      },
    },
  });
}

// Payroll generation silently skips any active employee with no salary
// structure — surfaced here so the Payroll page can point HR directly at who
// still needs one set up, instead of a bare "no salary structure configured"
// toast with no indication of where to fix it.
export async function getEmployeesWithoutSalaryStructure(organizationId: string) {
  return prisma.employee.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      deletedAt: null,
      salaryStructures: { none: { isActive: true } },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeCode: true },
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
