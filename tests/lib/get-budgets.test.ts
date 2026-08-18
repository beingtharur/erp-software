import { afterEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const aggregateMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    budget: { findMany: findManyMock },
    expenseClaim: { aggregate: aggregateMock },
  },
}));

const { getBudgets } = await import("@/lib/queries/finance");

afterEach(() => {
  vi.clearAllMocks();
});

describe("getBudgets", () => {
  it("scopes by org with no optional filters set", async () => {
    findManyMock.mockResolvedValue([]);

    await getBudgets("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          requestedBy: { organizationId: "org_1" },
          departmentId: undefined,
          status: undefined,
          startDate: undefined,
        },
      })
    );
  });

  it("applies department, status, and start-date range filters together", async () => {
    findManyMock.mockResolvedValue([]);
    const startDateFrom = new Date("2026-04-01T00:00:00");
    const startDateTo = new Date("2026-06-30T23:59:59.999");

    await getBudgets("org_1", { departmentId: "dept_1", status: "APPROVED", startDateFrom, startDateTo });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          requestedBy: { organizationId: "org_1" },
          departmentId: "dept_1",
          status: "APPROVED",
          startDate: { gte: startDateFrom, lte: startDateTo },
        },
      })
    );
  });

  it("computes spent per budget by aggregating matching approved/reimbursed expense claims", async () => {
    findManyMock.mockResolvedValue([
      { id: "budget_1", departmentId: "dept_1", category: "TRAVEL", startDate: new Date(), endDate: new Date() },
    ]);
    aggregateMock.mockResolvedValue({ _sum: { amount: 15000 } });

    const result = await getBudgets("org_1", {});

    expect(result[0].spent).toBe(15000);
    expect(aggregateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: "TRAVEL",
          status: { in: ["APPROVED", "REIMBURSED"] },
          employee: { departmentId: "dept_1", organizationId: "org_1" },
        }),
      })
    );
  });

  it("reports zero spend for a budget with no department, without summing the whole org", async () => {
    findManyMock.mockResolvedValue([
      { id: "budget_1", departmentId: null, category: "TRAVEL", startDate: new Date(), endDate: new Date() },
    ]);

    const result = await getBudgets("org_1", {});

    expect(result[0].spent).toBe(0);
    expect(aggregateMock).not.toHaveBeenCalled();
  });
});
