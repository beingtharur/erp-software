import { describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { lead: { findMany: findManyMock } },
}));

const { getLeadsForExport } = await import("@/lib/queries/crm");

describe("getLeadsForExport", () => {
  it("scopes by org with no date filter and no optional filters set", async () => {
    findManyMock.mockResolvedValue([]);

    await getLeadsForExport("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          client: { organizationId: "org_1" },
          stage: undefined,
          source: undefined,
          productLine: undefined,
          ownerId: undefined,
          expectedCloseDate: undefined,
        },
      })
    );
  });

  it("applies stage, source, product line, and owner filters together", async () => {
    findManyMock.mockResolvedValue([]);

    await getLeadsForExport("org_1", {
      stage: "QUALIFIED",
      source: "RFQ",
      productLine: "PROCESS_EQUIPMENT",
      ownerId: "emp_1",
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          client: { organizationId: "org_1" },
          stage: "QUALIFIED",
          source: "RFQ",
          productLine: "PROCESS_EQUIPMENT",
          ownerId: "emp_1",
          expectedCloseDate: undefined,
        },
      })
    );
  });

  it("builds a partial expectedCloseDate range when only one bound is given", async () => {
    findManyMock.mockResolvedValue([]);
    const expectedCloseFrom = new Date("2026-08-01T00:00:00");

    await getLeadsForExport("org_1", { expectedCloseFrom });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ expectedCloseDate: { gte: expectedCloseFrom } }),
      })
    );
  });

  it("orders by created date desc and includes client/owner for the export columns", async () => {
    findManyMock.mockResolvedValue([]);

    await getLeadsForExport("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        include: { client: true, owner: true },
      })
    );
  });
});
