import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getBudgets } from "@/lib/queries/finance";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { budgetExportColumns } from "@/lib/export/budgets";
import { logExport } from "@/lib/export/audit";

// Same access gates as /finance/budgets, the page this mirrors.
export async function GET(request: NextRequest) {
  await requireRole(["ADMIN", "FINANCE"]);
  await requireModuleAccess("finance");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  const params = request.nextUrl.searchParams;
  const departmentId = params.get("departmentId") || undefined;
  const status = params.get("status") || undefined;
  const fromParam = params.get("startDateFrom");
  const toParam = params.get("startDateTo");
  // No default range — a budget register is register data (like Vendor/PO),
  // not a recurring daily log, so unfiltered means "every budget."
  const startDateFrom = fromParam ? new Date(`${fromParam}T00:00:00`) : undefined;
  const startDateTo = toParam ? new Date(`${toParam}T23:59:59.999`) : undefined;

  const rows = await getBudgets(user.organizationId!, {
    departmentId,
    status,
    startDateFrom,
    startDateTo,
  });

  // Read even though Phase 1 doesn't expose these as UI controls on
  // /finance/budgets yet — every filter param works today via the URL.
  const filters: Record<string, unknown> = {};
  if (departmentId) filters.departmentId = departmentId;
  if (status) filters.status = status;
  if (fromParam) filters.startDateFrom = fromParam;
  if (toParam) filters.startDateTo = toParam;

  // Logged after the permission checks pass but before the response is built —
  // only genuinely-authorized, actually-served downloads get recorded.
  // reportType is stamped explicitly (unlike most other modules) since finance
  // exports are the ones most likely to get questioned later.
  await logExport({
    report: "budgets",
    reportType: "budgets",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: "Budget Report",
    organizationName: organization.name,
    sheetName: "Budgets",
    columns: budgetExportColumns,
    rows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("budgets")}"`,
    },
  });
}
