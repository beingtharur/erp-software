import { describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { leaveRequest: { findMany: findManyMock } },
}));

const { getLeaveRequestsForExport } = await import("@/lib/queries/hrms");

const fromDate = new Date("2026-08-01T00:00:00");
const toDate = new Date("2026-08-31T23:59:59.999");

describe("getLeaveRequestsForExport", () => {
  it("scopes by org and startDate range with no optional filters set", async () => {
    findManyMock.mockResolvedValue([]);

    await getLeaveRequestsForExport("org_1", { fromDate, toDate });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          startDate: { gte: fromDate, lte: toDate },
          type: undefined,
          status: undefined,
          employee: { organizationId: "org_1", id: undefined, departmentId: undefined },
        },
      })
    );
  });

  it("applies department, employee, type, and status filters together", async () => {
    findManyMock.mockResolvedValue([]);

    await getLeaveRequestsForExport("org_1", {
      fromDate,
      toDate,
      departmentId: "dept_1",
      employeeId: "emp_1",
      type: "SICK",
      status: "APPROVED",
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          startDate: { gte: fromDate, lte: toDate },
          type: "SICK",
          status: "APPROVED",
          employee: { organizationId: "org_1", id: "emp_1", departmentId: "dept_1" },
        },
      })
    );
  });

  it("orders by start date then employee name, and includes employee/department for the export columns", async () => {
    findManyMock.mockResolvedValue([]);

    await getLeaveRequestsForExport("org_1", { fromDate, toDate });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startDate: "asc" }, { employee: { name: "asc" } }],
        include: {
          employee: { select: { employeeCode: true, name: true, department: { select: { name: true } } } },
        },
      })
    );
  });
});
