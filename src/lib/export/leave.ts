import type { getLeaveRequestsForExport } from "@/lib/queries/hrms";
import { titleCase } from "@/lib/format";
import type { ExportColumn } from "@/lib/export/workbook";

export type LeaveExportRow = Awaited<ReturnType<typeof getLeaveRequestsForExport>>[number];

export const leaveExportColumns: ExportColumn<LeaveExportRow>[] = [
  { header: "Employee Code", value: (l) => l.employee.employeeCode },
  { header: "Employee Name", value: (l) => l.employee.name },
  { header: "Department", value: (l) => l.employee.department?.name ?? "—" },
  { header: "Leave Type", value: (l) => titleCase(l.type) },
  { header: "Start Date", value: (l) => l.startDate, numFmt: "dd-mmm-yyyy" },
  { header: "End Date", value: (l) => l.endDate, numFmt: "dd-mmm-yyyy" },
  { header: "Days", value: (l) => l.days },
  { header: "Status", value: (l) => titleCase(l.status) },
  { header: "Applied On", value: (l) => l.appliedOn, numFmt: "dd-mmm-yyyy" },
  { header: "Approved By", value: (l) => l.decidedBy ?? "—" },
];
