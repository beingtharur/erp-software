import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logAuditMock = vi.fn();
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { logExport } = await import("@/lib/export/audit");

beforeEach(() => {
  logAuditMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("logExport", () => {
  it("records the report, actor, and org via the existing AuditLog trail — no new table", async () => {
    await logExport({ report: "employees", organizationId: "org_1", userId: "user_1" });

    expect(logAuditMock).toHaveBeenCalledWith({
      organizationId: "org_1",
      actorId: "user_1",
      action: "export.employees",
      entityType: "Export",
      entityId: "employees",
      metadata: undefined,
    });
  });

  it("includes filters in metadata when provided", async () => {
    await logExport({
      report: "employees",
      organizationId: "org_1",
      userId: "user_1",
      filters: { status: "ACTIVE" },
    });

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { filters: { status: "ACTIVE" } } })
    );
  });

  it("omits metadata entirely when filters is an empty object, not an empty-object noise entry", async () => {
    await logExport({ report: "employees", organizationId: "org_1", userId: "user_1", filters: {} });

    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ metadata: undefined }));
  });

  it("includes reportType in metadata when a caller passes it, alongside filters", async () => {
    await logExport({
      report: "expense-claims",
      organizationId: "org_1",
      userId: "user_1",
      reportType: "expense-claims",
      filters: { status: "PENDING" },
    });

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { reportType: "expense-claims", filters: { status: "PENDING" } },
      })
    );
  });

  it("includes reportType alone when no filters are given, without leaving metadata undefined", async () => {
    await logExport({
      report: "budgets",
      organizationId: "org_1",
      userId: "user_1",
      reportType: "budgets",
    });

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { reportType: "budgets" } })
    );
  });

  it("defaults entityId to the report key when no override is given (every list/register export)", async () => {
    await logExport({ report: "quotations", organizationId: "org_1", userId: "user_1" });

    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ entityId: "quotations" }));
  });

  it("uses the given entityId override for a single-record document export", async () => {
    await logExport({
      report: "quotation-document",
      organizationId: "org_1",
      userId: "user_1",
      entityId: "QT-1026",
    });

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "export.quotation-document", entityId: "QT-1026" })
    );
  });
});
