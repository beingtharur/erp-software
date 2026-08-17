import { describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { vendor: { findMany: findManyMock } },
}));

const { getVendorsForExport } = await import("@/lib/queries/vendor");

describe("getVendorsForExport", () => {
  it("scopes by org with no date filter and no optional filters set", async () => {
    findManyMock.mockResolvedValue([]);

    await getVendorsForExport("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org_1",
          status: undefined,
          city: undefined,
          category: undefined,
          createdAt: undefined,
        },
      })
    );
  });

  it("applies status, city, and category filters together", async () => {
    findManyMock.mockResolvedValue([]);

    await getVendorsForExport("org_1", { status: "Active", city: "Vadodara", category: "Fabrication" });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org_1",
          status: "Active",
          city: "Vadodara",
          category: "Fabrication",
          createdAt: undefined,
        },
      })
    );
  });

  it("builds a partial createdAt range when only one bound is given", async () => {
    findManyMock.mockResolvedValue([]);
    const createdFrom = new Date("2026-01-01T00:00:00");

    await getVendorsForExport("org_1", { createdFrom });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: createdFrom } }),
      })
    );
  });

  it("includes purchaseOrders/payments counts for the export columns", async () => {
    findManyMock.mockResolvedValue([]);

    await getVendorsForExport("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: "asc" },
        include: { _count: { select: { purchaseOrders: true, payments: true } } },
      })
    );
  });
});
