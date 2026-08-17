import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getVendorsForExport } from "@/lib/queries/vendor";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { vendorExportColumns } from "@/lib/export/vendors";
import { logExport } from "@/lib/export/audit";

// Same access gates as /vendors, the page this mirrors.
export async function GET(request: NextRequest) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  await requireModuleAccess("vendors");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  const params = request.nextUrl.searchParams;
  const status = params.get("status") || undefined;
  const city = params.get("city") || undefined;
  const category = params.get("category") || undefined;
  const createdFromParam = params.get("createdFrom");
  const createdToParam = params.get("createdTo");
  const createdFrom = createdFromParam ? new Date(`${createdFromParam}T00:00:00`) : undefined;
  const createdTo = createdToParam ? new Date(`${createdToParam}T23:59:59.999`) : undefined;

  const rows = await getVendorsForExport(user.organizationId!, {
    status,
    city,
    category,
    createdFrom,
    createdTo,
  });

  // Read even though Phase 1 doesn't expose these as UI controls on /vendors
  // yet — every filter param works today via the URL.
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (city) filters.city = city;
  if (category) filters.category = category;
  if (createdFromParam) filters.createdFrom = createdFromParam;
  if (createdToParam) filters.createdTo = createdToParam;

  // Logged after the permission checks pass but before the response is built —
  // only genuinely-authorized, actually-served downloads get recorded.
  await logExport({
    report: "vendors",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: "Vendor Report",
    organizationName: organization.name,
    sheetName: "Vendors",
    columns: vendorExportColumns,
    rows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("vendors")}"`,
    },
  });
}
