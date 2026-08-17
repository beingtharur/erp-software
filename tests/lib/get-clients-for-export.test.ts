import { describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { client: { findMany: findManyMock } },
}));

const { getClientsForExport } = await import("@/lib/queries/crm");

describe("getClientsForExport", () => {
  it("scopes by org with no optional filters set", async () => {
    findManyMock.mockResolvedValue([]);

    await getClientsForExport("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org_1",
          industry: undefined,
          tier: undefined,
          city: undefined,
          state: undefined,
          status: undefined,
        },
      })
    );
  });

  it("applies industry, tier, city, state, and status filters together", async () => {
    findManyMock.mockResolvedValue([]);

    await getClientsForExport("org_1", {
      industry: "PHARMACEUTICALS",
      tier: "Strategic",
      city: "Vadodara",
      state: "Gujarat",
      status: "Active",
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org_1",
          industry: "PHARMACEUTICALS",
          tier: "Strategic",
          city: "Vadodara",
          state: "Gujarat",
          status: "Active",
        },
      })
    );
  });

  it("orders by name asc and includes leads/projects counts for the export columns", async () => {
    findManyMock.mockResolvedValue([]);

    await getClientsForExport("org_1", {});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: "asc" },
        include: { _count: { select: { leads: true, projects: true } } },
      })
    );
  });
});
