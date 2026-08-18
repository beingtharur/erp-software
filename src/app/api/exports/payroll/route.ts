import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getPayrollRecords } from "@/lib/queries/hrms";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { payrollRegisterColumns, periodLabel } from "@/lib/export/payroll-register";
import { logExport } from "@/lib/export/audit";
import { formatINR } from "@/lib/format";

// Same access gates as /hrms/payroll, the page this mirrors.
export async function GET(request: NextRequest) {
  await requireRole(["ADMIN", "HR"]);
  await requireModuleAccess("hrms");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  const params = request.nextUrl.searchParams;
  const monthParam = params.get("month");
  const yearParam = params.get("year");
  const month = monthParam ? Number(monthParam) : undefined;
  const year = yearParam ? Number(yearParam) : undefined;
  const departmentId = params.get("departmentId") || undefined;
  const status = params.get("status") || undefined;

  const rows = await getPayrollRecords(user.organizationId!, { month, year, departmentId, status });

  const filters: Record<string, unknown> = {};
  if (month) filters.month = month;
  if (year) filters.year = year;
  if (departmentId) filters.departmentId = departmentId;
  if (status) filters.status = status;

  // Logged after the permission checks pass but before the response is built —
  // only genuinely-authorized, actually-served downloads get recorded.
  await logExport({
    report: "payroll",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  // Summary totals are derived from the same rows the table shows, not a
  // separate aggregate query — so the numbers can never drift from what's
  // listed below them. Distinct employee count (not row count) because an
  // unfiltered, multi-period export can list one employee more than once.
  const totalEmployees = new Set(rows.map((r) => r.employeeId)).size;
  const totalGrossSalary = rows.reduce(
    (sum, r) => sum + r.basicSalary + r.allowances + r.bonus + r.overtimePay,
    0
  );
  const totalDeductions = rows.reduce((sum, r) => sum + r.deductions, 0);
  const totalNetSalary = rows.reduce((sum, r) => sum + r.netPay, 0);
  const periodText = month && year ? periodLabel(month, year) : "All periods";

  const buffer = await buildReportWorkbook({
    reportTitle: "Payroll Salary Register",
    organizationName: organization.name,
    sheetName: "Salary Register",
    columns: payrollRegisterColumns,
    rows,
    extraHeaderLines: [
      `Company Name: ${organization.name}`,
      `Period: ${periodText}`,
      `Total Employees: ${totalEmployees}`,
      `Total Gross Salary: ${formatINR(totalGrossSalary)}`,
      `Total Deductions: ${formatINR(totalDeductions)}`,
      `Total Net Salary: ${formatINR(totalNetSalary)}`,
    ],
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("payroll-salary-register")}"`,
    },
  });
}
