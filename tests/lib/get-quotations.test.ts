import { afterEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { quotation: { findMany: findManyMock } },
}));

const { getQuotations } = await import("@/lib/queries/crm");

afterEach(() => {
  vi.clearAllMocks();
});

describe("getQuotations", () => {
  it("scopes by org with no date filter and no optional filters set", async () => {
    findManyMock.mockResolvedValue([]);

    await getQuotations("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          client: { organizationId: "org_1" },
          clientId: undefined,
          status: undefined,
          revision: undefined,
          issuedOn: undefined,
        },
      })
    );
  });

  it("applies client, status, revision, and date range filters together", async () => {
    findManyMock.mockResolvedValue([]);
    const dateFrom = new Date("2026-08-01T00:00:00");
    const dateTo = new Date("2026-08-31T23:59:59.999");

    await getQuotations("org_1", { clientId: "client_1", status: "SENT", revision: 2, dateFrom, dateTo });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          client: { organizationId: "org_1" },
          clientId: "client_1",
          status: "SENT",
          revision: 2,
          issuedOn: { gte: dateFrom, lte: dateTo },
        },
      })
    );
  });

  it("orders by issued date desc and includes client/lead/lineItems for the export columns", async () => {
    findManyMock.mockResolvedValue([]);

    await getQuotations("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { issuedOn: "desc" },
        include: { client: true, lead: true, lineItems: { orderBy: { sortOrder: "asc" } } },
      })
    );
  });
});
