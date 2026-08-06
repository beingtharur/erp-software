import { prisma } from "@/lib/db";

export async function getExpenseClaims(organizationId: string) {
  const claims = await prisma.expenseClaim.findMany({
    where: { employee: { organizationId } },
    orderBy: { createdAt: "desc" },
    include: { employee: true },
  });

  const pendingClaimIds = claims.filter((c) => c.status === "PENDING").map((c) => c.id);
  const pendingApprovals = pendingClaimIds.length
    ? await prisma.approvalRequest.findMany({
        where: { entityType: "EXPENSE_CLAIM", entityId: { in: pendingClaimIds }, status: "PENDING" },
      })
    : [];
  const approvalIdByClaimId = new Map(pendingApprovals.map((a) => [a.entityId, a.id]));

  return claims.map((c) => ({ ...c, approvalId: approvalIdByClaimId.get(c.id) ?? null }));
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
