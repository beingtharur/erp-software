import { logAudit } from "@/lib/audit";

// Thin wrapper over the existing AuditLog trail — no new table. AuditLog.entityId
// is a plain, non-FK string field (already used for ad hoc identifiers elsewhere),
// so for an export — which reads many rows rather than acting on one specific
// record — it holds the report key itself (e.g. "employees") rather than a
// single entity id. entityType "Export" and action "export.<report>" keep these
// entries distinguishable from entity-lifecycle actions like "employee.created"
// while still queryable by report via entityId.
//
// reportType is optional and additive: entityId already carries the report key,
// so most modules don't need it duplicated inside metadata. Finance passes it
// explicitly so a metadata blob is self-explanatory in isolation, without
// needing to cross-reference entityId — finance exports are the ones most
// likely to get questioned later.
export async function logExport(params: {
  report: string;
  organizationId: string;
  userId: string;
  filters?: Record<string, unknown>;
  reportType?: string;
}) {
  const hasFilters = params.filters && Object.keys(params.filters).length > 0;
  const metadata: Record<string, unknown> = {};
  if (params.reportType) metadata.reportType = params.reportType;
  if (hasFilters) metadata.filters = params.filters;

  await logAudit({
    organizationId: params.organizationId,
    actorId: params.userId,
    action: `export.${params.report}`,
    entityType: "Export",
    entityId: params.report,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  });
}
