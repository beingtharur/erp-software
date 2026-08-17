import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireSuperAdminMock = vi.fn();
vi.mock("@/lib/dal", () => ({ requireSuperAdmin: requireSuperAdminMock }));

const paymentFindFirstMock = vi.fn();
const paymentUpdateMock = vi.fn();
const subscriptionFindUniqueMock = vi.fn();
const subscriptionUpdateMock = vi.fn();
const moduleDeleteManyMock = vi.fn();
const moduleCreateManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn((callback: (tx: unknown) => unknown) =>
      callback({
        payment: { findFirst: paymentFindFirstMock, update: paymentUpdateMock },
        subscription: { findUnique: subscriptionFindUniqueMock, update: subscriptionUpdateMock },
        subscriptionModule: { deleteMany: moduleDeleteManyMock, createMany: moduleCreateManyMock },
      })
    ),
  },
}));

const { approvePayment } = await import("@/lib/actions/platform-admin");

const superAdmin = { userId: "user_super", isSuperAdmin: true };

function basePayment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pay_1",
    subscriptionId: "sub_1",
    numUsers: 10,
    modules: JSON.stringify(["crm", "hrms"]),
    status: "PENDING",
    ...overrides,
  };
}

beforeEach(() => {
  requireSuperAdminMock.mockResolvedValue(superAdmin);
  paymentFindFirstMock.mockResolvedValue(basePayment());
  subscriptionFindUniqueMock.mockResolvedValue({
    id: "sub_1",
    currentPeriodEnd: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("approvePayment", () => {
  it("refuses to activate a subscription when the payment's modules array is empty", async () => {
    paymentFindFirstMock.mockResolvedValue(basePayment({ modules: JSON.stringify([]) }));

    await expect(approvePayment("pay_1")).rejects.toThrow(
      "cannot activate a subscription with zero modules"
    );

    // Nothing should have been written — the guard must fire before any state changes.
    expect(paymentUpdateMock).not.toHaveBeenCalled();
    expect(subscriptionUpdateMock).not.toHaveBeenCalled();
    expect(moduleCreateManyMock).not.toHaveBeenCalled();
  });

  it("approves normally and inserts every selected module when modules are present", async () => {
    await approvePayment("pay_1");

    expect(paymentUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) })
    );
    expect(subscriptionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) })
    );
    expect(moduleDeleteManyMock).toHaveBeenCalledWith({ where: { subscriptionId: "sub_1" } });
    expect(moduleCreateManyMock).toHaveBeenCalledWith({
      data: [
        { subscriptionId: "sub_1", module: "crm" },
        { subscriptionId: "sub_1", module: "hrms" },
      ],
    });
  });

  it("never leaves a subscription ACTIVE without inserting its modules in the same pass", async () => {
    // Regression guard for the exact production bug this fix addresses: an
    // ACTIVE Subscription row with zero SubscriptionModule rows.
    await approvePayment("pay_1");

    const subscriptionUpdateOrder = subscriptionUpdateMock.mock.invocationCallOrder[0];
    const moduleCreateOrder = moduleCreateManyMock.mock.invocationCallOrder[0];
    expect(subscriptionUpdateOrder).toBeLessThan(moduleCreateOrder);
    expect(moduleCreateManyMock.mock.calls[0][0].data.length).toBeGreaterThan(0);
  });
});
