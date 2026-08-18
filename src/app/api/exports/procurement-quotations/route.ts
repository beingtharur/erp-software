import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getProcurementQuotations } from "@/lib/queries/procurement-quotations";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { procurementQuotationColumns } from "@/lib/export/procurement-quotations";
import { logExport } from "@/lib/export/audit";

// Same gates as /vendors/quotations, the page this mirrors — the export
// inherits the access rules of the data it exposes, nothing more.
export async function GET(request: NextRequest) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  await requireModuleAccess("vendors");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  const params = request.nextUrl.searchParams;
  const dateFromParam = params.get("dateFrom");
  const dateToParam = params.get("dateTo");
  const dateFrom = dateFromParam ? new Date(`${dateFromParam}T00:00:00`) : undefined;
  const dateTo = dateToParam ? new Date(`${dateToParam}T23:59:59.999`) : undefined;
  const status = params.get("status") || undefined;
  const clientName = params.get("clientName") || undefined;
  const search = params.get("search") || undefined;

  const rows = await getProcurementQuotations(user.organizationId!, {
    dateFrom,
    dateTo,
    status,
    clientName,
    search,
  });

  // Recorded even when the page exposes no UI control for them yet — every
  // filter works from the query string from day one.
  const filters: Record<string, unknown> = {};
  if (dateFromParam) filters.dateFrom = dateFromParam;
  if (dateToParam) filters.dateTo = dateToParam;
  if (status) filters.status = status;
  if (clientName) filters.clientName = clientName;
  if (search) filters.search = search;

  // Logged after the permission checks pass but before the response is built —
  // only genuinely-authorized, actually-served downloads get recorded.
  await logExport({
    report: "procurement-quotations",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: "Procurement Quotation Register",
    organizationName: organization.name,
    sheetName: "Quotations",
    columns: procurementQuotationColumns,
    rows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("procurement-quotations")}"`,
    },
  });
}
