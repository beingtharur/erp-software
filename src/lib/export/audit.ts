import { logAudit } from "@/lib/audit";

// Thin wrapper over the existing AuditLog trail — no new table. AuditLog.entityId
// is a plain, non-FK string field (already used for ad hoc identifiers elsewhere),
// so for an export — which reads many rows rather than acting on one specific
// record — it holds the report key itself (e.g. "employees") rather than a
// single entity id. entityType "Export" and action "export.<report>" keep these
// entries distinguishable from entity-lifecycle actions like "employee.created"
// while still queryable by report via entityId.
export async function logExport(params: {
  report: string;
  organizationId: string;
  userId: string;
  filters?: Record<string, unknown>;
}) {
  const hasFilters = params.filters && Object.keys(params.filters).length > 0;
  await logAudit({
    organizationId: params.organizationId,
    actorId: params.userId,
    action: `export.${params.report}`,
    entityType: "Export",
    entityId: params.report,
    metadata: hasFilters ? { filters: params.filters } : undefined,
  });
}
