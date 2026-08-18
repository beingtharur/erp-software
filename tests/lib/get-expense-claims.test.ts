import { afterEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const approvalFindManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    expenseClaim: { findMany: findManyMock },
    approvalRequest: { findMany: approvalFindManyMock },
  },
}));

const { getExpenseClaims } = await import("@/lib/queries/finance");

afterEach(() => {
  vi.clearAllMocks();
});

describe("getExpenseClaims", () => {
  it("scopes by org with no optional filters set", async () => {
    findManyMock.mockResolvedValue([]);

    await getExpenseClaims("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { employee: { organizationId: "org_1", id: undefined, departmentId: undefined } },
      })
    );
    expect(approvalFindManyMock).not.toHaveBeenCalled();
  });

  it("applies employee, department, and expense-date range filters together", async () => {
    findManyMock.mockResolvedValue([]);
    const expenseDateFrom = new Date("2026-08-01T00:00:00");
    const expenseDateTo = new Date("2026-08-31T23:59:59.999");

    await getExpenseClaims("org_1", {
      employeeId: "emp_1",
      departmentId: "dept_1",
      expenseDateFrom,
      expenseDateTo,
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employee: { organizationId: "org_1", id: "emp_1", departmentId: "dept_1" },
          expenseDate: { gte: expenseDateFrom, lte: expenseDateTo },
        },
      })
    );
  });

  it("still applies status and search exactly as before (regression guard)", async () => {
    findManyMock.mockResolvedValue([]);

    await getExpenseClaims("org_1", { status: "APPROVED", search: "travel" });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "APPROVED",
          OR: [
            { claimNumber: { contains: "travel" } },
            { description: { contains: "travel" } },
            { employee: { name: { contains: "travel" } } },
          ],
        }),
      })
    );
  });

  it("joins the approval request to populate decidedByName/decidedOn when claims exist", async () => {
    findManyMock.mockResolvedValue([{ id: "claim_1" }]);
    approvalFindManyMock.mockResolvedValue([
      {
        entityId: "claim_1",
        status: "APPROVED",
        approverRole: "FINANCE",
        note: null,
        decidedBy: { name: "Vrushali Shah" },
        decidedOn: new Date("2026-08-10T00:00:00"),
      },
    ]);

    const result = await getExpenseClaims("org_1", {});

    expect(result[0]).toMatchObject({
      decidedByName: "Vrushali Shah",
      decidedOn: new Date("2026-08-10T00:00:00"),
    });
  });
});
