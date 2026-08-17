import type { getAttendanceForExport } from "@/lib/queries/hrms";
import { attendanceDayValue } from "@/lib/payroll";
import { formatTime, titleCase } from "@/lib/format";
import type { ExportColumn } from "@/lib/export/workbook";

export type AttendanceExportRow = Awaited<ReturnType<typeof getAttendanceForExport>>[number];

export const attendanceExportColumns: ExportColumn<AttendanceExportRow>[] = [
  { header: "Employee Code", value: (a) => a.employee.employeeCode },
  { header: "Employee Name", value: (a) => a.employee.name },
  { header: "Department", value: (a) => a.employee.department?.name ?? "—" },
  { header: "Date", value: (a) => a.date, numFmt: "dd-mmm-yyyy" },
  { header: "Check In", value: (a) => (a.checkIn ? formatTime(a.checkIn) : "—") },
  { header: "Check Out", value: (a) => (a.checkOut ? formatTime(a.checkOut) : "—") },
  { header: "Hours Worked", value: (a) => a.hoursWorked },
  { header: "Status", value: (a) => titleCase(a.status) },
  // ON_LEAVE rows are valued as paid — a persisted Attendance row has no link
  // back to the LeaveRequest that produced it, so an UNPAID-leave day can't
  // be told apart from a SICK/CASUAL/EARNED one here (attendanceDayValue's
  // default when no leave type is supplied). getAttendanceToday is the only
  // place the real leave type is available, and only for today. Known
  // simplification, not a bug.
  { header: "Day Value", value: (a) => attendanceDayValue(a.status) },
];
