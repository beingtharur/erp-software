import type { getEmployees } from "@/lib/queries/hrms";
import { employeeRoleName } from "@/lib/roles";
import { titleCase } from "@/lib/format";
import type { ExportColumn } from "@/lib/export/workbook";

// Row shape matches getEmployees()'s actual return type exactly — the export
// reuses that query rather than fetching its own copy of employee data, so
// this file only ever needs to define columns, never a data source.
export type EmployeeExportRow = Awaited<ReturnType<typeof getEmployees>>[number];

export const employeeExportColumns: ExportColumn<EmployeeExportRow>[] = [
  { header: "Employee Code", value: (e) => e.employeeCode },
  { header: "Employee Name", value: (e) => e.name },
  { header: "Department", value: (e) => e.department?.name ?? "—" },
  { header: "Designation", value: (e) => employeeRoleName(e.role) },
  { header: "Email", value: (e) => e.email },
  { header: "Phone", value: (e) => e.phone },
  { header: "Joining Date", value: (e) => e.dateOfJoining, numFmt: "dd-mmm-yyyy" },
  { header: "Status", value: (e) => titleCase(e.status) },
];
