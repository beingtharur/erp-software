import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// React's cache() memoizes per-request; outside a real request there's no request
// boundary to key on, so we make it a passthrough to keep each test isolated.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const readSessionCookieMock = vi.fn();
const decryptMock = vi.fn();
vi.mock("@/lib/session", () => ({
  readSessionCookie: readSessionCookieMock,
  decrypt: decryptMock,
}));

const findUniqueMock = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: findUniqueMock } },
}));

const { requireRole, getCurrentUser } = await import("@/lib/dal");

const adminSession = { userId: "user_admin", accessRole: "ADMIN" as const, name: "Admin User" };
const salesSession = { userId: "user_sales", accessRole: "SALES" as const, name: "Sales Rep" };

beforeEach(() => {
  redirectMock.mockClear();
  readSessionCookieMock.mockReset();
  decryptMock.mockReset();
  findUniqueMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("requireRole", () => {
  it("returns the session when the role is in the allow-list", async () => {
    readSessionCookieMock.mockResolvedValue("cookie");
    decryptMock.mockResolvedValue(adminSession);

    const result = await requireRole(["ADMIN", "HR"]);
    expect(result).toEqual(adminSession);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /access-denied when the role is not in the allow-list", async () => {
    readSessionCookieMock.mockResolvedValue("cookie");
    decryptMock.mockResolvedValue(salesSession);

    await expect(requireRole(["ADMIN", "HR"])).rejects.toThrow("REDIRECT:/access-denied");
  });

  it("redirects to /login before checking roles when there is no session at all", async () => {
    readSessionCookieMock.mockResolvedValue(undefined);
    decryptMock.mockResolvedValue(null);

    await expect(requireRole(["ADMIN"])).rejects.toThrow("REDIRECT:/login");
  });

  it("never authorizes a role that isn't explicitly allowed, even ADMIN vs a HR-only route", async () => {
    readSessionCookieMock.mockResolvedValue("cookie");
    decryptMock.mockResolvedValue(adminSession);

    // Sanity check the inverse of the "ADMIN can do everything" assumption baked into nav.ts:
    // requireRole itself does exactly what its allow-list says, no implicit ADMIN bypass.
    await expect(requireRole(["HR"])).rejects.toThrow("REDIRECT:/access-denied");
  });
});

describe("getCurrentUser", () => {
  it("returns the user record for a valid session", async () => {
    readSessionCookieMock.mockResolvedValue("cookie");
    decryptMock.mockResolvedValue(adminSession);
    const dbUser = { id: "user_admin", email: "admin@eostechno.com", employee: null };
    findUniqueMock.mockResolvedValue(dbUser);

    const result = await getCurrentUser();
    expect(result).toEqual(dbUser);
    // The employee's department is loaded alongside the employee: it's rendered
    // in the profile header, and it's what a future department-aware permission
    // rule would read (user.employee.departmentId) without another query.
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: "user_admin" },
      include: {
        employee: { include: { department: { select: { id: true, name: true } } } },
      },
    });
  });

  it("redirects with a session=expired marker when the session references a deleted user", async () => {
    // Regression test for the infinite /login <-> / redirect loop: a stale JWT that
    // still decrypts fine but points at a User row that no longer exists (e.g. after
    // a reseed) must not be treated as "logged in".
    readSessionCookieMock.mockResolvedValue("cookie");
    decryptMock.mockResolvedValue(adminSession);
    findUniqueMock.mockResolvedValue(null);

    await expect(getCurrentUser()).rejects.toThrow("REDIRECT:/login?session=expired");
  });
});
