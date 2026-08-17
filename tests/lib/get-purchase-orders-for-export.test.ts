import { describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { purchaseOrder: { findMany: findManyMock } },
}));

const { getPurchaseOrdersForExport } = await import("@/lib/queries/vendor");

describe("getPurchaseOrdersForExport", () => {
  it("scopes by org with no date filter and no optional filters set", async () => {
    findManyMock.mockResolvedValue([]);

    await getPurchaseOrdersForExport("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vendor: { organizationId: "org_1" },
          status: undefined,
          vendorId: undefined,
          orderDate: undefined,
        },
      })
    );
  });

  it("applies status, vendor, and order-date range filters together", async () => {
    findManyMock.mockResolvedValue([]);
    const fromDate = new Date("2026-01-01T00:00:00");
    const toDate = new Date("2026-01-31T23:59:59.999");

    await getPurchaseOrdersForExport("org_1", { status: "SENT", vendorId: "vendor_1", fromDate, toDate });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vendor: { organizationId: "org_1" },
          status: "SENT",
          vendorId: "vendor_1",
          orderDate: { gte: fromDate, lte: toDate },
        },
      })
    );
  });

  it("orders by order date desc and includes the vendor for export columns", async () => {
    findManyMock.mockResolvedValue([]);

    await getPurchaseOrdersForExport("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { orderDate: "desc" },
        include: { vendor: true },
      })
    );
  });
});
