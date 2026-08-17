import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getLeadsForExport } from "@/lib/queries/crm";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { leadExportColumns } from "@/lib/export/leads";
import { logExport } from "@/lib/export/audit";

// Same access gates as /crm, the page this mirrors.
export async function GET(request: NextRequest) {
  await requireRole(["ADMIN", "SALES"]);
  await requireModuleAccess("crm");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  const params = request.nextUrl.searchParams;
  const stage = params.get("stage") || undefined;
  const source = params.get("source") || undefined;
  const productLine = params.get("productLine") || undefined;
  const ownerId = params.get("ownerId") || undefined;
  const fromParam = params.get("expectedCloseFrom");
  const toParam = params.get("expectedCloseTo");
  const expectedCloseFrom = fromParam ? new Date(`${fromParam}T00:00:00`) : undefined;
  const expectedCloseTo = toParam ? new Date(`${toParam}T23:59:59.999`) : undefined;

  const rows = await getLeadsForExport(user.organizationId!, {
    stage,
    source,
    productLine,
    ownerId,
    expectedCloseFrom,
    expectedCloseTo,
  });

  // Read even though Phase 1 doesn't expose these as UI controls on /crm
  // yet — every filter param works today via the URL.
  const filters: Record<string, unknown> = {};
  if (stage) filters.stage = stage;
  if (source) filters.source = source;
  if (productLine) filters.productLine = productLine;
  if (ownerId) filters.ownerId = ownerId;
  if (fromParam) filters.expectedCloseFrom = fromParam;
  if (toParam) filters.expectedCloseTo = toParam;

  // Logged after the permission checks pass but before the response is built —
  // only genuinely-authorized, actually-served downloads get recorded.
  await logExport({
    report: "leads",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: "Lead Report",
    organizationName: organization.name,
    sheetName: "Leads",
    columns: leadExportColumns,
    rows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("leads")}"`,
    },
  });
}
