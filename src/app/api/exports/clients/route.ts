import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getClientsForExport } from "@/lib/queries/crm";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { clientExportColumns } from "@/lib/export/clients";
import { logExport } from "@/lib/export/audit";

// Same access gates as /crm/clients, the page this mirrors. Named "clients"
// throughout (route, report key, filename) to match the actual model and
// existing UI route — "Customer" doesn't exist anywhere in this codebase.
export async function GET(request: NextRequest) {
  await requireRole(["ADMIN", "SALES"]);
  await requireModuleAccess("crm");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  const params = request.nextUrl.searchParams;
  const industry = params.get("industry") || undefined;
  const tier = params.get("tier") || undefined;
  const city = params.get("city") || undefined;
  const state = params.get("state") || undefined;
  const status = params.get("status") || undefined;

  const rows = await getClientsForExport(user.organizationId!, {
    industry,
    tier,
    city,
    state,
    status,
  });

  // Read even though Phase 1 doesn't expose these as UI controls on
  // /crm/clients yet — every filter param works today via the URL.
  const filters: Record<string, unknown> = {};
  if (industry) filters.industry = industry;
  if (tier) filters.tier = tier;
  if (city) filters.city = city;
  if (state) filters.state = state;
  if (status) filters.status = status;

  // Logged after the permission checks pass but before the response is built —
  // only genuinely-authorized, actually-served downloads get recorded.
  await logExport({
    report: "clients",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: "Client Report",
    organizationName: organization.name,
    sheetName: "Clients",
    columns: clientExportColumns,
    rows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("clients")}"`,
    },
  });
}
