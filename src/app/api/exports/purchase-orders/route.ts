import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getPurchaseOrdersForExport } from "@/lib/queries/vendor";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { purchaseOrderExportColumns } from "@/lib/export/purchase-orders";
import { logExport } from "@/lib/export/audit";

// Same access gates as /vendors/purchase-orders, the page this mirrors.
export async function GET(request: NextRequest) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  await requireModuleAccess("vendors");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  const params = request.nextUrl.searchParams;
  const status = params.get("status") || undefined;
  const vendorId = params.get("vendorId") || undefined;
  const fromParam = params.get("fromDate");
  const toParam = params.get("toDate");
  const fromDate = fromParam ? new Date(`${fromParam}T00:00:00`) : undefined;
  const toDate = toParam ? new Date(`${toParam}T23:59:59.999`) : undefined;

  const rows = await getPurchaseOrdersForExport(user.organizationId!, {
    status,
    vendorId,
    fromDate,
    toDate,
  });

  // Read even though Phase 1 doesn't expose these as UI controls on
  // /vendors/purchase-orders yet — every filter param works today via the URL.
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (vendorId) filters.vendorId = vendorId;
  if (fromParam) filters.fromDate = fromParam;
  if (toParam) filters.toDate = toParam;

  // Logged after the permission checks pass but before the response is built —
  // only genuinely-authorized, actually-served downloads get recorded.
  await logExport({
    report: "purchase-orders",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: "Purchase Order Report",
    organizationName: organization.name,
    sheetName: "Purchase Orders",
    columns: purchaseOrderExportColumns,
    rows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("purchase-orders")}"`,
    },
  });
}
