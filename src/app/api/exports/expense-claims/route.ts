import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getExpenseClaims } from "@/lib/queries/finance";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { expenseClaimExportColumns } from "@/lib/export/expense-claims";
import { logExport } from "@/lib/export/audit";

// Same access gates as /finance, the page this mirrors.
export async function GET(request: NextRequest) {
  await requireRole(["ADMIN", "FINANCE"]);
  await requireModuleAccess("finance");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  const params = request.nextUrl.searchParams;

  // Defaults to month-to-date when no range is given — expense claims are a
  // recurring, dated log (like Attendance/Leave), not slow-changing master
  // data, so an unfiltered export needs a bound.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const status = params.get("status") || undefined;
  const employeeId = params.get("employeeId") || undefined;
  const departmentId = params.get("departmentId") || undefined;
  const fromParam = params.get("expenseDateFrom");
  const toParam = params.get("expenseDateTo");
  const expenseDateFrom = fromParam ? new Date(`${fromParam}T00:00:00`) : monthStart;
  const expenseDateTo = toParam ? new Date(`${toParam}T23:59:59.999`) : todayEnd;

  const rows = await getExpenseClaims(user.organizationId!, {
    status,
    employeeId,
    departmentId,
    expenseDateFrom,
    expenseDateTo,
  });

  // Read even though Phase 1 doesn't expose these as UI controls on /finance
  // yet — every filter param works today via the URL.
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (employeeId) filters.employeeId = employeeId;
  if (departmentId) filters.departmentId = departmentId;
  if (fromParam) filters.expenseDateFrom = fromParam;
  if (toParam) filters.expenseDateTo = toParam;

  // Logged after the permission checks pass but before the response is built —
  // only genuinely-authorized, actually-served downloads get recorded.
  // reportType is stamped explicitly (unlike most other modules) since finance
  // exports are the ones most likely to get questioned later.
  await logExport({
    report: "expense-claims",
    reportType: "expense-claims",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: "Expense Claims Report",
    organizationName: organization.name,
    sheetName: "Expense Claims",
    columns: expenseClaimExportColumns,
    rows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("expense-claims")}"`,
    },
  });
}
