import { prisma } from "@/lib/db";

export async function getExpenseClaims() {
  return prisma.expenseClaim.findMany({
    orderBy: { createdAt: "desc" },
    include: { employee: true },
  });
}

export async function getMyExpenseClaims(employeeId: string) {
  return prisma.expenseClaim.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export async function getBudgets() {
  const budgets = await prisma.budget.findMany({
    orderBy: { startDate: "desc" },
    include: { requestedBy: true },
  });

  const spentByBudget = await Promise.all(
    budgets.map(async (b) => {
      const result = await prisma.expenseClaim.aggregate({
        where: {
          category: b.category,
          status: { in: ["APPROVED", "REIMBURSED"] },
          expenseDate: { gte: b.startDate, lte: b.endDate },
          employee: { department: b.department },
        },
        _sum: { amount: true },
      });
      return result._sum.amount ?? 0;
    })
  );

  return budgets.map((b, i) => ({ ...b, spent: spentByBudget[i] }));
}
