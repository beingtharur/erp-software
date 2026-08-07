import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression coverage for the multi-tenancy bug: Employee.email used to be
// globally @unique with an unscoped findUnique({ where: { email } }) lookup,
// so a brand-new org's very first employee failed with "already exists" the
// instant the email coincided with ANY other org's employee (seed data alone
// occupies dozens of emails). The fix is @@unique([organizationId, email]) +
// scoping every pre-insert lookup by organizationId — these tests pin that
// query shape so a future edit can't silently regress it back to a bare
// email-only lookup.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireRoleMock = vi.fn();
const getCurrentUserMock = vi.fn();
vi.mock("@/lib/dal", () => ({
  requireRole: requireRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("@/lib/notify", () => ({ notifyUser: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/password", () => ({
  hashPassword: () => ({ hash: "h", salt: "s" }),
}));

const employeeFindFirstMock = vi.fn();
const userFindUniqueMock = vi.fn();
const txEmployeeCount = vi.fn().mockResolvedValue(0);
const txEmployeeCreate = vi.fn().mockImplementation(({ data }) => ({ id: "emp_new", ...data }));
const txUserCreate = vi.fn().mockResolvedValue({});
const txSubscriptionFindUnique = vi.fn().mockResolvedValue({ licencedUsers: 50 });
const txUserCount = vi.fn().mockResolvedValue(1);

vi.mock("@/lib/db", () => ({
  prisma: {
    employee: { findFirst: employeeFindFirstMock },
    user: { findUnique: userFindUniqueMock },
    $transaction: async (cb: (tx: unknown) => unknown) =>
      cb({
        employee: { count: txEmployeeCount, create: txEmployeeCreate },
        user: { create: txUserCreate, count: txUserCount },
        subscription: { findUnique: txSubscriptionFindUnique },
      }),
  },
}));

const { createEmployee } = await import("@/lib/actions/hrms");

function formDataFor(orgLabel: string) {
  const fd = new FormData();
  fd.set("name", "Kiran Deshpande");
  fd.set("role", "ENGINEER");
  fd.set("departmentId", "");
  fd.set("email", "kiran.deshpande@example.com");
  fd.set("phone", "+91 90000 00000");
  fd.set("dateOfJoining", "2026-01-01");
  fd.set("baseLocation", orgLabel);
  fd.set("accessRole", "ADMIN");
  return fd;
}

beforeEach(() => {
  requireRoleMock.mockResolvedValue(undefined);
  userFindUniqueMock.mockResolvedValue(null);
  employeeFindFirstMock.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createEmployee — organization isolation", () => {
  it("scopes the pre-insert duplicate-email check by organizationId, not a bare email lookup", async () => {
    getCurrentUserMock.mockResolvedValue({ organizationId: "org_a" });

    await createEmployee(undefined, formDataFor("org_a"));

    expect(employeeFindFirstMock).toHaveBeenCalledWith({
      where: { organizationId: "org_a", email: "kiran.deshpande@example.com" },
    });
  });

  it("lets two different organizations create an employee with the same email", async () => {
    // Each org's findFirst only ever sees its own rows — simulate that by
    // returning null regardless of email, since the mock is org-agnostic;
    // the real regression was the *query shape* (no org filter at all), which
    // the assertion above already pins. This test exercises the success path
    // end-to-end for both orgs to confirm neither is rejected.
    getCurrentUserMock.mockResolvedValueOnce({ organizationId: "org_a" });
    const resultA = await createEmployee(undefined, formDataFor("org_a"));
    expect(resultA).toEqual({ success: true });

    getCurrentUserMock.mockResolvedValueOnce({ organizationId: "org_b" });
    const resultB = await createEmployee(undefined, formDataFor("org_b"));
    expect(resultB).toEqual({ success: true });

    expect(employeeFindFirstMock).toHaveBeenNthCalledWith(1, {
      where: { organizationId: "org_a", email: "kiran.deshpande@example.com" },
    });
    expect(employeeFindFirstMock).toHaveBeenNthCalledWith(2, {
      where: { organizationId: "org_b", email: "kiran.deshpande@example.com" },
    });
  });

  it("still blocks a genuine duplicate within the same organization", async () => {
    getCurrentUserMock.mockResolvedValue({ organizationId: "org_a" });
    employeeFindFirstMock.mockResolvedValue({ id: "existing_emp" });

    const result = await createEmployee(undefined, formDataFor("org_a"));
    expect(result).toEqual({ error: "An employee with this email already exists." });
  });
});
