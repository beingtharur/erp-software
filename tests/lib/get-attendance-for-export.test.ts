import { describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { attendance: { findMany: findManyMock } },
}));

const { getAttendanceForExport } = await import("@/lib/queries/hrms");

const fromDate = new Date("2026-08-01T00:00:00");
const toDate = new Date("2026-08-31T23:59:59.999");

describe("getAttendanceForExport", () => {
  it("scopes by org and date range with no optional filters set", async () => {
    findManyMock.mockResolvedValue([]);

    await getAttendanceForExport("org_1", { fromDate, toDate });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date: { gte: fromDate, lte: toDate },
          status: undefined,
          employee: { organizationId: "org_1", id: undefined, departmentId: undefined },
        },
      })
    );
  });

  it("applies department, employee, and status filters together", async () => {
    findManyMock.mockResolvedValue([]);

    await getAttendanceForExport("org_1", {
      fromDate,
      toDate,
      departmentId: "dept_1",
      employeeId: "emp_1",
      status: "PRESENT",
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date: { gte: fromDate, lte: toDate },
          status: "PRESENT",
          employee: { organizationId: "org_1", id: "emp_1", departmentId: "dept_1" },
        },
      })
    );
  });

  it("orders by date then employee name, and includes employee/department for the export columns", async () => {
    findManyMock.mockResolvedValue([]);

    await getAttendanceForExport("org_1", { fromDate, toDate });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ date: "asc" }, { employee: { name: "asc" } }],
        include: {
          employee: { select: { employeeCode: true, name: true, department: { select: { name: true } } } },
        },
      })
    );
  });
});
