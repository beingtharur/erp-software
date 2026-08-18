import { afterEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { payrollRecord: { findMany: findManyMock } },
}));

const { getPayrollRecords } = await import("@/lib/queries/hrms");

afterEach(() => {
  vi.clearAllMocks();
});

describe("getPayrollRecords", () => {
  it("scopes by org with no optional filters set when called with no args", async () => {
    findManyMock.mockResolvedValue([]);

    await getPayrollRecords("org_1");

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employee: { organizationId: "org_1", departmentId: undefined },
          month: undefined,
          year: undefined,
          status: undefined,
        },
      })
    );
  });

  it("applies month, year, department, and status filters together", async () => {
    findManyMock.mockResolvedValue([]);

    await getPayrollRecords("org_1", { month: 8, year: 2026, departmentId: "dept_1", status: "PROCESSED" });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employee: { organizationId: "org_1", departmentId: "dept_1" },
          month: 8,
          year: 2026,
          status: "PROCESSED",
        },
      })
    );
  });

  it("orders by year/month desc and includes department name for the export column", async () => {
    findManyMock.mockResolvedValue([]);

    await getPayrollRecords("org_1");

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ year: "desc" }, { month: "desc" }],
        include: {
          employee: {
            include: {
              salaryStructures: { where: { isActive: true }, take: 1 },
              department: { select: { name: true } },
            },
          },
        },
      })
    );
  });
});
