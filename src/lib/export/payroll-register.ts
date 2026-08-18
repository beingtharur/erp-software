import type { getPayrollRecords } from "@/lib/queries/hrms";
import { titleCase } from "@/lib/format";
import type { ExportColumn } from "@/lib/export/workbook";

export type PayrollRegisterRow = Awaited<ReturnType<typeof getPayrollRecords>>[number];

export function periodLabel(month: number, year: number): string {
  return new Date(year, month - 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

// Month and Year are separate columns rather than one "Aug 2026" cell so the
// register stays pivotable and filterable in Excel. The short month name (not
// the raw 1-12 int) matches how /hrms/payroll renders the same record, so the
// export and the page never read differently for the same row.
export function monthName(month: number): string {
  return new Date(2000, month - 1).toLocaleDateString("en-IN", { month: "short" });
}

export const payrollRegisterColumns: ExportColumn<PayrollRegisterRow>[] = [
  { header: "Employee Code", value: (r) => r.employee.employeeCode },
  { header: "Employee Name", value: (r) => r.employee.name },
  { header: "Department", value: (r) => r.employee.department?.name ?? "—" },
  { header: "Basic Salary", value: (r) => r.basicSalary },
  { header: "Allowances", value: (r) => r.allowances },
  { header: "Bonus", value: (r) => r.bonus },
  { header: "Overtime Pay", value: (r) => r.overtimePay },
  { header: "Deductions", value: (r) => r.deductions },
  { header: "Net Pay", value: (r) => r.netPay },
  { header: "Status", value: (r) => titleCase(r.status) },
  { header: "Month", value: (r) => monthName(r.month) },
  { header: "Year", value: (r) => r.year },
];
