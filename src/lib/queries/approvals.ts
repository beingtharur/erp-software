import { prisma } from "@/lib/db";
import type { AccessRole, Prisma } from "@/generated/prisma/client";

export async function getPendingApprovals(role: AccessRole, organizationId: string) {
  // ADMIN and HR always see every pending expense claim for visibility (per
  // the client's ask), even when a different role is the configured decider
  // (Organization.expenseApproverRole) — canDecide below is what actually
  // gates the Approve/Reject buttons, not this visibility filter.
  const where: Prisma.ApprovalRequestWhereInput = {
    status: "PENDING",
    requestedBy: { organizationId },
    OR:
      role === "ADMIN" || role === "HR"
        ? [{ approverRole: role }, { entityType: "EXPENSE_CLAIM" }]
        : [{ approverRole: role }],
  };

  const approvals = await prisma.approvalRequest.findMany({
    where,
    include: { requestedBy: true },
    orderBy: { createdAt: "asc" },
  });

  const poIds = approvals.filter((a) => a.entityType === "PURCHASE_ORDER").map((a) => a.entityId);
  const purchaseOrders = poIds.length
    ? await prisma.purchaseOrder.findMany({
        where: { id: { in: poIds }, vendor: { organizationId } },
        include: { vendor: true },
      })
    : [];
  const poById = new Map(purchaseOrders.map((po) => [po.id, po]));

  const claimIds = approvals.filter((a) => a.entityType === "EXPENSE_CLAIM").map((a) => a.entityId);
  const claims = claimIds.length
    ? await prisma.expenseClaim.findMany({
        where: { id: { in: claimIds }, employee: { organizationId } },
        include: { employee: { select: { name: true, department: { select: { name: true } } } }, attachments: true },
      })
    : [];
  const claimById = new Map(claims.map((c) => [c.id, c]));

  const budgetIds = approvals.filter((a) => a.entityType === "BUDGET").map((a) => a.entityId);
  const budgets = budgetIds.length
    ? await prisma.budget.findMany({
        where: { id: { in: budgetIds }, requestedBy: { organizationId } },
        include: { department: { select: { id: true, name: true } } },
      })
    : [];
  const budgetById = new Map(budgets.map((b) => [b.id, b]));

  return approvals.map((a) => ({
    ...a,
    purchaseOrder: a.entityType === "PURCHASE_ORDER" ? (poById.get(a.entityId) ?? null) : null,
    expenseClaim: a.entityType === "EXPENSE_CLAIM" ? (claimById.get(a.entityId) ?? null) : null,
    budget: a.entityType === "BUDGET" ? (budgetById.get(a.entityId) ?? null) : null,
    // Mirrors decideApproval's own authorization check — ADMIN can always
    // decide, everyone else only when they're the stamped approverRole.
    canDecide: role === "ADMIN" || a.approverRole === role,
  }));
}
