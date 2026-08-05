import { beforeEach, describe, expect, it, vi } from "vitest";

// Phase 3 added a second way to create a Project (manual, from the Projects
// page) alongside the original quotation conversion. The requirement is that a
// project behaves identically afterwards no matter which path made it, so both
// actions run through initializeProject() and these tests pin that: same
// defaults, same notifications, same audit entry, same revalidation — with only
// clientId/leadId/quotationId differing by origin.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireRoleMock = vi.fn();
const getCurrentUserMock = vi.fn();
vi.mock("@/lib/dal", () => ({
  requireRole: requireRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

const notifyEmployeeRoleMock = vi.fn();
const notifyRoleMock = vi.fn();
vi.mock("@/lib/notify", () => ({
  notifyEmployeeRole: notifyEmployeeRoleMock,
  notifyRole: notifyRoleMock,
  notifyEmployee: vi.fn(),
}));

const logAuditMock = vi.fn();
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const projectCreateMock = vi.fn();
const clientFindFirstMock = vi.fn();
const quotationFindFirstMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    project: { create: projectCreateMock },
    client: { findFirst: clientFindFirstMock },
    quotation: { findFirst: quotationFindFirstMock },
  },
}));

// Dynamic import so the mock factories above are initialized first — a static
// import is hoisted above the `const …Mock = vi.fn()` declarations they close
// over (same pattern as create-employee-org-isolation.test.ts).
const { revalidatePath } = await import("next/cache");
const { createProject, convertQuotationToProject } = await import("@/lib/actions/crm");

const CLIENT = { id: "client_1", name: "Acme Chemicals", industry: "CHEMICALS" };

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    name: "Containment upgrade",
    description: "",
    productLine: "CONTAINMENT_SYSTEMS",
    startDate: "2026-01-01",
    targetEndDate: "2026-06-01",
    value: "500000",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

/** Every project column except the two that record where the project came from. */
function withoutOriginLinkage(data: Record<string, unknown>) {
  const rest = { ...data };
  delete rest.leadId;
  delete rest.quotationId;
  return rest;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue({ id: "user_1", organizationId: "org_1" });
  requireRoleMock.mockResolvedValue(undefined);
  projectCreateMock.mockImplementation(({ data }) => ({ id: "proj_new", ...data }));
  clientFindFirstMock.mockResolvedValue(CLIENT);
  quotationFindFirstMock.mockResolvedValue({
    id: "quote_1",
    quoteNumber: "QT-1001",
    clientId: CLIENT.id,
    leadId: "lead_1",
    status: "APPROVED",
    project: null,
    client: CLIENT,
  });
});

describe("createProject authorization and organization isolation", () => {
  it("is restricted to the same roles as quotation conversion", async () => {
    await createProject(undefined, form({ clientId: CLIENT.id }));
    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN", "SALES"]);
  });

  it("resolves the client scoped to the caller's organization", async () => {
    await createProject(undefined, form({ clientId: CLIENT.id }));
    expect(clientFindFirstMock).toHaveBeenCalledWith({
      where: { id: CLIENT.id, organizationId: "org_1" },
    });
  });

  it("refuses a client that does not belong to the caller's organization", async () => {
    clientFindFirstMock.mockResolvedValue(null);
    const result = await createProject(undefined, form({ clientId: "other_org_client" }));
    expect(result).toEqual({ error: "Client not found." });
    expect(projectCreateMock).not.toHaveBeenCalled();
  });
});

describe("shared validation", () => {
  it("rejects a target end date before the start date on both paths", async () => {
    const bad = { startDate: "2026-06-01", targetEndDate: "2026-01-01" };
    expect(await createProject(undefined, form({ clientId: CLIENT.id, ...bad }))).toEqual({
      error: "Target end date must be on or after the start date.",
    });
    expect(await convertQuotationToProject(undefined, form({ quotationId: "quote_1", ...bad }))).toEqual({
      error: "Target end date must be on or after the start date.",
    });
    expect(projectCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a product line outside the enum on both paths", async () => {
    const bad = { productLine: "NOT_A_PRODUCT_LINE" };
    expect(await createProject(undefined, form({ clientId: CLIENT.id, ...bad }))).toEqual({
      error: "Select a valid product line.",
    });
    expect(await convertQuotationToProject(undefined, form({ quotationId: "quote_1", ...bad }))).toEqual({
      error: "Select a valid product line.",
    });
    expect(projectCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a non-positive value", async () => {
    const result = await createProject(undefined, form({ clientId: CLIENT.id, value: "0" }));
    expect(result).toEqual({ error: "Enter a valid project value." });
  });
});

describe("both creation paths produce an identical project", () => {
  it("differs only in lead/quotation linkage", async () => {
    await createProject(undefined, form({ clientId: CLIENT.id }));
    const manual = projectCreateMock.mock.calls[0][0].data;

    vi.clearAllMocks();
    projectCreateMock.mockImplementation(({ data }) => ({ id: "proj_new", ...data }));
    await convertQuotationToProject(undefined, form({ quotationId: "quote_1" }));
    const converted = projectCreateMock.mock.calls[0][0].data;

    // The origin linkage is the only intended difference.
    expect(manual.leadId).toBeNull();
    expect(manual.quotationId).toBeNull();
    expect(converted.leadId).toBe("lead_1");
    expect(converted.quotationId).toBe("quote_1");

    expect(withoutOriginLinkage(manual)).toEqual(withoutOriginLinkage(converted));

    // Neither path may seed status or progress — both must fall through to the
    // schema defaults (PLANNING / 0) so the two look the same on day one.
    expect(manual).not.toHaveProperty("status");
    expect(manual).not.toHaveProperty("progressPercent");
    expect(converted).not.toHaveProperty("status");
    expect(converted).not.toHaveProperty("progressPercent");

    // Industry is inherited from the client on both paths, never user-supplied.
    expect(manual.industry).toBe(CLIENT.industry);
    expect(converted.industry).toBe(CLIENT.industry);
  });

  it("notifies project managers and admins on both paths", async () => {
    await createProject(undefined, form({ clientId: CLIENT.id }));
    expect(notifyEmployeeRoleMock).toHaveBeenCalledWith(
      "PROJECT_MANAGER",
      "org_1",
      expect.stringContaining("Containment upgrade"),
      "/crm/projects/proj_new"
    );
    expect(notifyRoleMock).toHaveBeenCalledWith(
      "ADMIN",
      "org_1",
      expect.stringContaining("Containment upgrade"),
      "/crm/projects/proj_new"
    );

    vi.clearAllMocks();
    projectCreateMock.mockImplementation(({ data }) => ({ id: "proj_new", ...data }));
    await convertQuotationToProject(undefined, form({ quotationId: "quote_1" }));
    expect(notifyEmployeeRoleMock).toHaveBeenCalledWith(
      "PROJECT_MANAGER",
      "org_1",
      expect.stringContaining("QT-1001"),
      "/crm/projects/proj_new"
    );
    expect(notifyRoleMock).toHaveBeenCalledTimes(1);
  });

  it("writes a project.created audit entry on both paths", async () => {
    await createProject(undefined, form({ clientId: CLIENT.id }));
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        actorId: "user_1",
        action: "project.created",
        entityType: "Project",
        entityId: "proj_new",
        metadata: expect.objectContaining({ origin: "manual" }),
      })
    );

    vi.clearAllMocks();
    projectCreateMock.mockImplementation(({ data }) => ({ id: "proj_new", ...data }));
    await convertQuotationToProject(undefined, form({ quotationId: "quote_1" }));
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "project.created",
        entityType: "Project",
        metadata: expect.objectContaining({ origin: "quotation", quotationId: "quote_1" }),
      })
    );
  });

  it("revalidates every shared surface a new project appears on", async () => {
    await createProject(undefined, form({ clientId: CLIENT.id }));
    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    // Listing, detail, client page, pipeline, site-visit picker, timesheet
    // picker and the dashboard KPIs all read project rows.
    for (const p of [
      "/crm/projects",
      "/crm/projects/proj_new",
      `/crm/clients/${CLIENT.id}`,
      "/crm",
      "/crm/site-visits",
      "/me",
      "/",
    ]) {
      expect(paths).toContain(p);
    }
  });

  it("still guards conversion-only rules", async () => {
    quotationFindFirstMock.mockResolvedValue({
      id: "quote_1",
      quoteNumber: "QT-1001",
      status: "SENT",
      clientId: CLIENT.id,
      leadId: null,
      project: null,
      client: CLIENT,
    });
    expect(await convertQuotationToProject(undefined, form({ quotationId: "quote_1" }))).toEqual({
      error: "Only approved quotations can be converted.",
    });

    quotationFindFirstMock.mockResolvedValue({
      id: "quote_1",
      quoteNumber: "QT-1001",
      status: "APPROVED",
      clientId: CLIENT.id,
      leadId: null,
      project: { id: "existing" },
      client: CLIENT,
    });
    expect(await convertQuotationToProject(undefined, form({ quotationId: "quote_1" }))).toEqual({
      error: "Project already created.",
    });
    expect(projectCreateMock).not.toHaveBeenCalled();
  });
});
