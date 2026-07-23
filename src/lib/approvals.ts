import "server-only";
import { prisma } from "@/lib/db";
import type { AccessRole, ApprovalEntityType } from "@/generated/prisma/client";

export async function requestApproval({
  entityType,
  entityId,
  requestedById,
  approverRole,
  note,
}: {
  entityType: ApprovalEntityType;
  entityId: string;
  requestedById: string;
  approverRole: AccessRole;
  note?: string;
}) {
  return prisma.approvalRequest.create({
    data: { entityType, entityId, requestedById, approverRole, note },
  });
}
