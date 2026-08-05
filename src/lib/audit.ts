import "server-only";
import { prisma } from "@/lib/db";

// Append-only trail for the highest-stakes state changes (employee create/update,
// approval decisions, payment confirmation, role changes). Not a general-purpose
// activity feed — only the specific call sites that need one call this. actorId
// is a User id (the authenticated identity), not an Employee id, so this still
// records who acted even when the actor has no linked Employee.
export async function logAudit(params: {
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    },
  });
}
