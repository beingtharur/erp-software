import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireRoleMock = vi.fn();
const getCurrentUserMock = vi.fn();
vi.mock("@/lib/dal", () => ({
  requireRole: requireRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

const notifyEmployeeMock = vi.fn();
vi.mock("@/lib/notify", () => ({ notifyEmployee: notifyEmployeeMock }));

const logAuditMock = vi.fn();
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const findFirstMock = vi.fn();
const updateManyMock = vi.fn();
const poUpdateMock = vi.fn();
const vendorPaymentCreateMock = vi.fn();
const vendorPaymentUpdateMock = vi.fn();
const expenseClaimUpdateMock = vi.fn();
const budgetUpdateMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    approvalRequest: { findFirst: findFirstMock, updateMany: updateManyMock },
    purchaseOrder: { update: poUpdateMock },
    vendorPayment: { create: vendorPaymentCreateMock, update: vendorPaymentUpdateMock },
    expenseClaim: { update: expenseClaimUpdateMock },
    budget: { update: budgetUpdateMock },
  },
}));

const { decideApproval } = await import("@/lib/actions/approvals");

const decider = { id: "user_admin2", employeeId: "emp_admin2", organizationId: "org_1" };

function baseApproval(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "appr_1",
    entityType: "PURCHASE_ORDER",
    entityId: "po_1",
    requestedById: "emp_requester",
    approverRole: "ADMIN",
    status: "PENDING",
    ...overrides,
  };
}

beforeEach(() => {
  getCurrentUserMock.mockResolvedValue(decider);
  requireRoleMock.mockResolvedValue(undefined);
  updateManyMock.mockResolvedValue({ count: 1 });
  poUpdateMock.mockResolvedValue({ id: "po_1", poNumber: "PO-1001", vendorId: "v1", vendor: { name: "Acme" } });
  vendorPaymentCreateMock.mockResolvedValue({});
  vendorPaymentUpdateMock.mockResolvedValue({ amount: 5000, vendor: { name: "Acme" } });
  expenseClaimUpdateMock.mockResolvedValue({ claimNumber: "EXP-2001", amount: 1000 });
  budgetUpdateMock.mockResolvedValue({ department: "Ops", proposedAmount: 2000 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("decideApproval", () => {
  it("throws when the approval request doesn't exist (or belongs to another org)", async () => {
    findFirstMock.mockResolvedValue(null);
    await expect(decideApproval("missing", "APPROVED")).rejects.toThrow("Approval request not found");
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("re-derives the org filter from the decider, not a client-supplied value", async () => {
    findFirstMock.mockResolvedValue(baseApproval());
    await decideApproval("appr_1", "APPROVED");
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "appr_1", requestedBy: { organizationId: "org_1" } },
    });
  });

  it("rejects a double-decision race: a second decision on an already-decided request throws", async () => {
    findFirstMock.mockResolvedValue(baseApproval());
    updateManyMock.mockResolvedValue({ count: 0 });

    await expect(decideApproval("appr_1", "APPROVED")).rejects.toThrow(
      "This request has already been decided"
    );
    // The guard must be a status-scoped write, not a bare id-scoped one —
    // otherwise it can't distinguish "already decided" from "found".
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "appr_1", status: "PENDING" },
      data: expect.objectContaining({ status: "APPROVED" }),
    });
    expect(poUpdateMock).not.toHaveBeenCalled();
  });

  it("maker-checker: refuses to let the payment-confirmation requester decide their own request", async () => {
    findFirstMock.mockResolvedValue(
      baseApproval({ entityType: "PAYMENT_CONFIRMATION", requestedById: decider.employeeId })
    );

    await expect(decideApproval("appr_1", "APPROVED")).rejects.toThrow(
      "You can't confirm a payment you submitted yourself"
    );
    // Must fail before any state is mutated.
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(vendorPaymentUpdateMock).not.toHaveBeenCalled();
  });

  it("maker-checker does not block a different decider confirming a payment", async () => {
    findFirstMock.mockResolvedValue(
      baseApproval({ entityType: "PAYMENT_CONFIRMATION", requestedById: "emp_someone_else" })
    );

    await decideApproval("appr_1", "APPROVED");
    expect(vendorPaymentUpdateMock).toHaveBeenCalled();
  });

  it("does not apply the payment-confirmation self-decision restriction to other entity types", async () => {
    findFirstMock.mockResolvedValue(
      baseApproval({ entityType: "PURCHASE_ORDER", requestedById: decider.employeeId })
    );
    await decideApproval("appr_1", "APPROVED");
    expect(poUpdateMock).toHaveBeenCalled();
  });

  it("approving a payment confirmation marks the VendorPayment PAID with confirmedBy/confirmedAt", async () => {
    findFirstMock.mockResolvedValue(baseApproval({ entityType: "PAYMENT_CONFIRMATION", entityId: "pay_1" }));

    await decideApproval("appr_1", "APPROVED");

    expect(vendorPaymentUpdateMock).toHaveBeenCalledWith({
      where: { id: "pay_1" },
      data: expect.objectContaining({
        status: "PAID",
        confirmedById: decider.employeeId,
        paidDate: expect.any(Date),
        confirmedAt: expect.any(Date),
      }),
      include: { vendor: true },
    });
  });

  it("rejecting a payment confirmation leaves the VendorPayment status untouched (no silent auto-fail)", async () => {
    findFirstMock.mockResolvedValue(baseApproval({ entityType: "PAYMENT_CONFIRMATION", entityId: "pay_1" }));

    await decideApproval("appr_1", "REJECTED");

    expect(vendorPaymentUpdateMock).toHaveBeenCalledWith({
      where: { id: "pay_1" },
      data: {},
      include: { vendor: true },
    });
  });

  it("approving a purchase order creates exactly one VendorPayment", async () => {
    findFirstMock.mockResolvedValue(baseApproval());
    await decideApproval("appr_1", "APPROVED");
    expect(vendorPaymentCreateMock).toHaveBeenCalledTimes(1);
    expect(poUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "SENT" } })
    );
  });

  it("rejecting a purchase order cancels it and creates no VendorPayment", async () => {
    findFirstMock.mockResolvedValue(baseApproval());
    await decideApproval("appr_1", "REJECTED");
    expect(vendorPaymentCreateMock).not.toHaveBeenCalled();
    expect(poUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } })
    );
  });

  it("logs an audit entry with the deciding user, not the requester", async () => {
    findFirstMock.mockResolvedValue(baseApproval());
    await decideApproval("appr_1", "APPROVED");
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        actorId: decider.id,
        action: "approval.approved",
        entityType: "PURCHASE_ORDER",
        entityId: "po_1",
      })
    );
  });

  it("enforces the approverRole gate using the request's stored role, not the entity type", async () => {
    findFirstMock.mockResolvedValue(baseApproval({ approverRole: "FINANCE" }));
    await decideApproval("appr_1", "APPROVED");
    expect(requireRoleMock).toHaveBeenCalledWith(["FINANCE"]);
  });
});
