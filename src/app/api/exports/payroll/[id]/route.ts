import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getPayrollRecordDetail } from "@/lib/queries/hrms";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { buildPayslipBreakdown, payslipColumns } from "@/lib/export/payslip";
import { periodLabel } from "@/lib/export/payroll-register";
import { logExport } from "@/lib/export/audit";
import { formatINR, titleCase } from "@/lib/format";

// Same access gates as /hrms/payroll, the page this mirrors.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "HR"]);
  await requireModuleAccess("hrms");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();
  const { id } = await params;

  const record = await getPayrollRecordDetail(id, user.organizationId!);
  if (!record) {
    return new Response("Payroll record not found", { status: 404 });
  }

  const breakdown = buildPayslipBreakdown(record);
  if (breakdown.hasDiscrepancy) {
    console.warn(
      `[payslip export] discrepancy for payroll record ${record.id} (employee ${record.employee.employeeCode}, ${record.month}/${record.year}): ${breakdown.discrepancyDetail}`
    );
  }

  // Logged after the permission checks and the not-found check pass —
  // entityId names the specific employee + period downloaded, not just that
  // "a" payslip was.
  await logExport({
    report: "payslip",
    organizationId: user.organizationId!,
    userId: user.id,
    entityId: `${record.employee.employeeCode}-${record.month}-${record.year}`,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: `Payslip — ${periodLabel(record.month, record.year)}`,
    organizationName: organization.name,
    sheetName: "Payslip",
    columns: payslipColumns,
    rows: breakdown.rows,
    extraHeaderLines: [
      `Employee Code: ${record.employee.employeeCode}`,
      `Employee Name: ${record.employee.name}`,
      `Department: ${record.employee.department?.name ?? "—"}`,
      `Period: ${periodLabel(record.month, record.year)}`,
      `Status: ${titleCase(record.status)}`,
    ],
    footerLines: [
      `Gross Earnings: ${formatINR(breakdown.grossEarnings)}`,
      `Total Deductions: ${formatINR(breakdown.totalDeductions)}`,
      `Net Pay: ${formatINR(record.netPay)}`,
    ],
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename(`payslip-${record.employee.employeeCode.toLowerCase()}`)}"`,
    },
  });
}
