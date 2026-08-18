import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getQuotations } from "@/lib/queries/crm";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { quotationRegisterColumns } from "@/lib/export/quotations-register";
import { logExport } from "@/lib/export/audit";

// Same access as /crm/quotations, the page this mirrors — PROCUREMENT is
// included because Sachin's Quotations-only grant covers this page (see
// CrmLayout), and the export shouldn't be a dead end on a page he can see.
export async function GET(request: NextRequest) {
  await requireRole(["ADMIN", "SALES", "PROCUREMENT"]);
  await requireModuleAccess("crm");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  const params = request.nextUrl.searchParams;
  const dateFromParam = params.get("dateFrom");
  const dateToParam = params.get("dateTo");
  const dateFrom = dateFromParam ? new Date(`${dateFromParam}T00:00:00`) : undefined;
  const dateTo = dateToParam ? new Date(`${dateToParam}T23:59:59.999`) : undefined;
  const clientId = params.get("clientId") || undefined;
  const status = params.get("status") || undefined;
  const revisionParam = params.get("revision");
  const revision = revisionParam ? Number(revisionParam) : undefined;

  const rows = await getQuotations(user.organizationId!, {
    dateFrom,
    dateTo,
    clientId,
    status,
    revision,
  });

  // Read even though Phase 1 doesn't expose these as UI controls on
  // /crm/quotations yet — every filter param works today via the URL.
  const filters: Record<string, unknown> = {};
  if (dateFromParam) filters.dateFrom = dateFromParam;
  if (dateToParam) filters.dateTo = dateToParam;
  if (clientId) filters.clientId = clientId;
  if (status) filters.status = status;
  if (revision !== undefined) filters.revision = revision;

  // Logged after the permission checks pass but before the response is built —
  // only genuinely-authorized, actually-served downloads get recorded.
  await logExport({
    report: "quotations",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: "Quotation Register",
    organizationName: organization.name,
    sheetName: "Quotations",
    columns: quotationRegisterColumns,
    rows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("quotations")}"`,
    },
  });
}
