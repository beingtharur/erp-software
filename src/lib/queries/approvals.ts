import { prisma } from "@/lib/db";
import type { AccessRole } from "@/generated/prisma/client";

export async function getPendingApprovals(role: AccessRole, organizationId: string) {
  const approvals = await prisma.approvalRequest.findMany({
    where: { status: "PENDING", approverRole: role, requestedBy: { organizationId } },
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
    ? await prisma.expenseClaim.findMany({ where: { id: { in: claimIds }, employee: { organizationId } } })
    : [];
  const claimById = new Map(claims.map((c) => [c.id, c]));

  const budgetIds = approvals.filter((a) => a.entityType === "BUDGET").map((a) => a.entityId);
  const budgets = budgetIds.length
    ? await prisma.budget.findMany({ where: { id: { in: budgetIds }, requestedBy: { organizationId } } })
    : [];
  const budgetById = new Map(budgets.map((b) => [b.id, b]));

  return approvals.map((a) => ({
    ...a,
    purchaseOrder: a.entityType === "PURCHASE_ORDER" ? (poById.get(a.entityId) ?? null) : null,
    expenseClaim: a.entityType === "EXPENSE_CLAIM" ? (claimById.get(a.entityId) ?? null) : null,
    budget: a.entityType === "BUDGET" ? (budgetById.get(a.entityId) ?? null) : null,
  }));
}
