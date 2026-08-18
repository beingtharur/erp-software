import { afterEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { procurementQuotation: { findMany: findManyMock } },
}));

const { getProcurementQuotations } = await import("@/lib/queries/procurement-quotations");

afterEach(() => {
  vi.clearAllMocks();
});

describe("getProcurementQuotations", () => {
  it("scopes by org and returns latest versions only when no filters are set", async () => {
    findManyMock.mockResolvedValue([]);

    await getProcurementQuotations("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org_1", isLatest: true },
      })
    );
  });

  it("ignores the sentinel ALL status rather than filtering on it", async () => {
    findManyMock.mockResolvedValue([]);

    await getProcurementQuotations("org_1", { status: "ALL" });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org_1", isLatest: true },
      })
    );
  });

  it("applies status, client and date range together", async () => {
    findManyMock.mockResolvedValue([]);
    const dateFrom = new Date("2026-08-01T00:00:00");
    const dateTo = new Date("2026-08-31T23:59:59.999");

    await getProcurementQuotations("org_1", {
      status: "APPROVED",
      clientName: "JSW",
      dateFrom,
      dateTo,
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org_1",
          isLatest: true,
          status: "APPROVED",
          clientName: { contains: "JSW" },
          quotationDate: { gte: dateFrom, lte: dateTo },
        },
      })
    );
  });

  it("supports an open-ended date range", async () => {
    findManyMock.mockResolvedValue([]);
    const dateFrom = new Date("2026-08-01T00:00:00");

    await getProcurementQuotations("org_1", { dateFrom });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ quotationDate: { gte: dateFrom } }),
      })
    );
  });

  it("keeps the existing free-text search across number, vendor, project and client", async () => {
    findManyMock.mockResolvedValue([]);

    await getProcurementQuotations("org_1", { search: "pump" });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { quotationNumber: { contains: "pump" } },
            { vendorName: { contains: "pump" } },
            { projectName: { contains: "pump" } },
            { clientName: { contains: "pump" } },
          ],
        }),
      })
    );
  });
});
