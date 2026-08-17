import { prisma } from "@/lib/db";
import type { AccessRole, Prisma } from "@/generated/prisma/client";

export type ExpenseClaimFilters = {
  status?: string;
  search?: string;
};

export async function getExpenseClaims(organizationId: string, filters: ExpenseClaimFilters = {}) {
  const where: Prisma.ExpenseClaimWhereInput = { employee: { organizationId } };
  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status as never;
  }
  if (filters.search) {
    where.OR = [
      { claimNumber: { contains: filters.search } },
      { description: { contains: filters.search } },
      { employee: { name: { contains: filters.search } } },
    ];
  }

  const claims = await prisma.expenseClaim.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      employee: { include: { department: { select: { name: true } } } },
      attachments: true,
    },
  });

  // Pull the approval request for every claim (any status, not just pending) so
  // the list can show a lightweight "Approved by X on Y" history line, plus the
  // submitter's note, alongside the live pending decide-buttons.
  const claimIds = claims.map((c) => c.id);
  const approvals = claimIds.length
    ? await prisma.approvalRequest.findMany({
        where: { entityType: "EXPENSE_CLAIM", entityId: { in: claimIds } },
        include: { decidedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const approvalByClaimId = new Map(approvals.map((a) => [a.entityId, a]));

  return claims.map((c) => {
    const approval = approvalByClaimId.get(c.id);
    return {
      ...c,
      approvalId: approval?.status === "PENDING" ? approval.id : null,
      approverRole: approval?.approverRole ?? null,
      note: approval?.note ?? null,
      decidedByName: approval?.decidedBy?.name ?? null,
      decidedOn: approval?.decidedOn ?? null,
    };
  });
}

// Pending expense claims for the HRMS Overview dashboard card — HR always has
// visibility here regardless of which role is configured to decide (see
// Organization.expenseApproverRole and getPendingApprovals, whose canDecide
// logic this mirrors: ADMIN can always decide, everyone else only when
// they're the stamped approverRole).
export async function getPendingExpenseClaimsForHr(
  organizationId: string,
  viewerRole: AccessRole,
  take = 6
) {
  const claims = await prisma.expenseClaim.findMany({
    where: { status: "PENDING", employee: { organizationId } },
    orderBy: { createdAt: "asc" },
    take,
    include: { employee: { select: { name: true, department: { select: { name: true } } } } },
  });
  const pendingApprovals = claims.length
    ? await prisma.approvalRequest.findMany({
        where: { entityType: "EXPENSE_CLAIM", entityId: { in: claims.map((c) => c.id) }, status: "PENDING" },
      })
    : [];
  const approvalByClaimId = new Map(pendingApprovals.map((a) => [a.entityId, a]));

  const total = await prisma.expenseClaim.count({ where: { status: "PENDING", employee: { organizationId } } });

  return {
    total,
    claims: claims.map((c) => {
      const approval = approvalByClaimId.get(c.id);
      const canDecide = viewerRole === "ADMIN" || approval?.approverRole === viewerRole;
      return { ...c, approvalId: approval?.id ?? null, canDecide };
    }),
  };
}

export async function getMyExpenseClaims(employeeId: string) {
  return prisma.expenseClaim.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export async function getBudgets(organizationId: string) {
  const budgets = await prisma.budget.findMany({
    where: { requestedBy: { organizationId } },
    orderBy: { startDate: "desc" },
    include: { requestedBy: true, department: { select: { id: true, name: true } } },
  });

  const spentByBudget = await Promise.all(
    budgets.map(async (b) => {
      // Spend used to be matched by comparing two free-text department strings,
      // which silently missed anything spelled differently. It now joins on the
      // department itself. A budget with no department can't attribute spend, so
      // it reports zero rather than accidentally summing the whole org.
      if (!b.departmentId) return 0;
      const result = await prisma.expenseClaim.aggregate({
        where: {
          category: b.category,
          status: { in: ["APPROVED", "REIMBURSED"] },
          expenseDate: { gte: b.startDate, lte: b.endDate },
          employee: { departmentId: b.departmentId, organizationId },
        },
        _sum: { amount: true },
      });
      return result._sum.amount ?? 0;
    })
  );

  return budgets.map((b, i) => ({ ...b, spent: spentByBudget[i] }));
}
