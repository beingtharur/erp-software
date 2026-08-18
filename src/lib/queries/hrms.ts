import { prisma } from "@/lib/db";
import { getTaskStats } from "@/lib/queries/tasks";
import { getDepartmentHeadcount } from "@/lib/queries/departments";
import { getPendingExpenseClaimsForHr } from "@/lib/queries/finance";
import { attendanceDayValue } from "@/lib/payroll";
import type {
  AccessRole,
  AttendanceStatus,
  LeaveType,
  LeaveStatus,
  PayrollStatus,
} from "@/generated/prisma/client";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getHrmsOverview(organizationId: string, viewerRole: AccessRole) {
  const today = startOfToday();
  const now = new Date();

  const [
    totalActive,
    attendanceToday,
    pendingLeave,
    pendingHalfDay,
    onLeaveToday,
    pendingPayroll,
    recentLeaveRequests,
    departmentHeadcount,
    taskStats,
    pendingExpenseClaims,
  ] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE", organizationId, deletedAt: null } }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: { date: today, employee: { organizationId } },
      _count: true,
    }),
    prisma.leaveRequest.count({ where: { status: "PENDING", employee: { organizationId } } }),
    // Half-Day approvals are a distinct workflow the client wants surfaced on
    // its own, separate from the general "pending leave" figure above.
    prisma.leaveRequest.count({
      where: { status: "PENDING", type: "HALF_DAY", employee: { organizationId } },
    }),
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
    // HR dashboard visibility into pending expense claims — see the client's
    // Travel Expense requirement and Organization.expenseApproverRole.
    getPendingExpenseClaimsForHr(organizationId, viewerRole),
  ]);

  return {
    totalActive,
    attendanceToday,
    pendingLeave,
    pendingHalfDay,
    onLeaveToday,
    pendingPayroll,
    recentLeaveRequests,
    departmentHeadcount,
    taskStats,
    pendingExpenseClaims,
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
      return { ...record, employee, leaveType: null, dayValue: attendanceDayValue(record.status) };
    }
    const leave = leaveByEmployee.get(employee.id);
    if (leave) {
      // A Half-Day leave is reflected as HALF_DAY here too, not the generic
      // ON_LEAVE placeholder — decideLeaveRequest also persists a real
      // Attendance row on approval, so this synthetic fallback only matters
      // before that write lands or as a defense-in-depth backstop.
      const status = leave.type === "HALF_DAY" ? ("HALF_DAY" as const) : ("ON_LEAVE" as const);
      return {
        id: `leave-${leave.id}`,
        employee,
        checkIn: null,
        checkOut: null,
        hoursWorked: 0,
        status,
        leaveType: leave.type,
        dayValue: attendanceDayValue(status, leave.type),
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
      dayValue: 0,
    };
  });
}

export type AttendanceExportFilters = {
  fromDate: Date;
  toDate: Date;
  departmentId?: string;
  employeeId?: string;
  status?: string;
};

// Attendance across a date range for the whole org — unlike getAttendanceToday
// (today-only, which synthesizes ABSENT/ON_LEAVE placeholder rows so every
// active employee appears), this reads only real, persisted Attendance rows.
// A multi-day report has no single "today's roster" to backfill against, so
// a day with no row for an employee simply doesn't appear — that's correct
// for a historical report, not a bug.
export async function getAttendanceForExport(organizationId: string, filters: AttendanceExportFilters) {
  return prisma.attendance.findMany({
    where: {
      date: { gte: filters.fromDate, lte: filters.toDate },
      status: filters.status ? (filters.status as AttendanceStatus) : undefined,
      employee: {
        organizationId,
        id: filters.employeeId || undefined,
        departmentId: filters.departmentId || undefined,
      },
    },
    orderBy: [{ date: "asc" }, { employee: { name: "asc" } }],
    include: {
      employee: { select: { employeeCode: true, name: true, department: { select: { name: true } } } },
    },
  });
}

// Live "leave taken this year" usage summary by type — half-days count as 0.5.
// There is no entitlement/quota system anywhere in this schema, so this is
// deliberately a usage summary, not a remaining-balance calculation.
export async function getLeaveBalanceSummary(employeeId: string, year: number) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const grouped = await prisma.leaveRequest.groupBy({
    by: ["type"],
    where: {
      employeeId,
      status: "APPROVED",
      startDate: { gte: yearStart, lt: yearEnd },
    },
    _sum: { days: true },
  });

  return grouped
    .map((g) => ({ type: g.type, days: g._sum.days ?? 0 }))
    .sort((a, b) => b.days - a.days);
}

export async function getLeaveRequests(organizationId: string) {
  return prisma.leaveRequest.findMany({
    where: { employee: { organizationId } },
    orderBy: { appliedOn: "desc" },
    include: { employee: true },
  });
}

export type LeaveExportFilters = {
  fromDate: Date;
  toDate: Date;
  departmentId?: string;
  employeeId?: string;
  type?: string;
  status?: string;
};

// Filtered by startDate falling in the range — a "leave register for period
// X" reads as requests starting in that period, not every request whose
// span happens to overlap it.
export async function getLeaveRequestsForExport(organizationId: string, filters: LeaveExportFilters) {
  return prisma.leaveRequest.findMany({
    where: {
      startDate: { gte: filters.fromDate, lte: filters.toDate },
      type: filters.type ? (filters.type as LeaveType) : undefined,
      status: filters.status ? (filters.status as LeaveStatus) : undefined,
      employee: {
        organizationId,
        id: filters.employeeId || undefined,
        departmentId: filters.departmentId || undefined,
      },
    },
    orderBy: [{ startDate: "asc" }, { employee: { name: "asc" } }],
    include: {
      employee: { select: { employeeCode: true, name: true, department: { select: { name: true } } } },
    },
  });
}

export type PayrollFilters = {
  month?: number;
  year?: number;
  departmentId?: string;
  status?: string;
};

export async function getPayrollRecords(organizationId: string, filters: PayrollFilters = {}) {
  return prisma.payrollRecord.findMany({
    where: {
      employee: { organizationId, departmentId: filters.departmentId || undefined },
      month: filters.month || undefined,
      year: filters.year || undefined,
      status: filters.status ? (filters.status as PayrollStatus) : undefined,
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      employee: {
        include: {
          // Tells the row's salary button whether to say "Set up Salary" (never
          // configured — a past PayrollRecord can exist from before a structure
          // was required, e.g. seed data) or "Change Salary Structure".
          salaryStructures: { where: { isActive: true }, take: 1 },
          department: { select: { name: true } },
        },
      },
    },
  });
}

// For a single payslip: the structure that was actually used to compute this
// record (via salaryStructureId, fixed at generation time), not the
// employee's current active one — those can differ once a structure is later
// changed, and a past payslip must keep reflecting what was true when it was
// generated. Also unlike getPayrollRecords, this is genuinely nullable: seed
// data (and any pre-structure-era record) has no linked structure at all.
export async function getPayrollRecordDetail(id: string, organizationId: string) {
  return prisma.payrollRecord.findFirst({
    where: { id, employee: { organizationId } },
    include: {
      employee: { include: { department: { select: { name: true } } } },
      salaryStructure: true,
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
