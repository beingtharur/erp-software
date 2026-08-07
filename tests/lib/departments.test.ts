import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Coverage for the Department module's guardrails: parent-cycle prevention,
// per-organization uniqueness of department codes, organization isolation on
// head/parent lookups, and parent-assignment validation. These are the rules
// wouldCreateCycle() and parseDepartmentInput() enforce in
// src/lib/actions/departments.ts but that had no dedicated test coverage.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireRoleMock = vi.fn();
const getCurrentUserMock = vi.fn();
vi.mock("@/lib/dal", () => ({
  requireRole: requireRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

const logAuditMock = vi.fn();
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const departmentFindUniqueMock = vi.fn();
const departmentFindFirstMock = vi.fn();
const departmentCreateMock = vi.fn();
const departmentUpdateMock = vi.fn();
const employeeFindFirstMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    department: {
      findUnique: departmentFindUniqueMock,
      findFirst: departmentFindFirstMock,
      create: departmentCreateMock,
      update: departmentUpdateMock,
    },
    employee: { findFirst: employeeFindFirstMock },
  },
}));

const { createDepartment, updateDepartment } = await import("@/lib/actions/departments");

const ORG = "org_1";
const actor = { id: "user_hr", organizationId: ORG };

function formDataFor(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("name", "Quality Assurance");
  fd.set("code", "qa");
  fd.set("type", "DEPARTMENT");
  fd.set("description", "");
  fd.set("headId", "none");
  fd.set("parentId", "none");
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value);
  return fd;
}

function uniqueConstraintError() {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

beforeEach(() => {
  requireRoleMock.mockResolvedValue(undefined);
  getCurrentUserMock.mockResolvedValue(actor);
  employeeFindFirstMock.mockResolvedValue({ id: "emp_head" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createDepartment — duplicate code", () => {
  it("surfaces a friendly error when the [organizationId, code] unique constraint fires", async () => {
    departmentCreateMock.mockRejectedValue(uniqueConstraintError());

    const result = await createDepartment(undefined, formDataFor());

    expect(result).toEqual({ error: "A department with that code already exists." });
  });

  it("scopes the create to the caller's organization", async () => {
    departmentCreateMock.mockResolvedValue({ id: "dept_new", name: "Quality Assurance", code: "QA" });

    await createDepartment(undefined, formDataFor());

    expect(departmentCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: ORG, code: "QA" }),
    });
  });
});

describe("createDepartment — organization isolation on head/parent", () => {
  it("rejects a headId that doesn't resolve within the caller's organization", async () => {
    // employee.findFirst is itself scoped by organizationId in the action, so
    // returning null here simulates "that employee belongs to another org".
    employeeFindFirstMock.mockResolvedValue(null);

    const result = await createDepartment(undefined, formDataFor({ headId: "emp_other_org" }));

    expect(result).toEqual({ error: "Department head not found." });
    expect(employeeFindFirstMock).toHaveBeenCalledWith({
      where: { id: "emp_other_org", organizationId: ORG, deletedAt: null },
      select: { id: true },
    });
    expect(departmentCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a parentId that doesn't resolve within the caller's organization", async () => {
    departmentFindFirstMock.mockResolvedValue(null);

    const result = await createDepartment(undefined, formDataFor({ parentId: "dept_other_org" }));

    expect(result).toEqual({ error: "Parent department not found." });
    expect(departmentFindFirstMock).toHaveBeenCalledWith({
      where: { id: "dept_other_org", organizationId: ORG },
      select: { id: true },
    });
    expect(departmentCreateMock).not.toHaveBeenCalled();
  });
});

describe("updateDepartment — parent assignment validation", () => {
  it("rejects a department reporting to itself", async () => {
    departmentFindFirstMock.mockImplementation(({ where }: { where: { id: string } }) =>
      where.id === "dept_a"
        ? { id: "dept_a", name: "Engineering" }
        : { id: where.id }
    );

    const result = await updateDepartment(
      undefined,
      formDataFor({ departmentId: "dept_a", parentId: "dept_a" })
    );

    expect(result).toEqual({ error: "A department can't report to itself." });
    expect(departmentUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects a parentId that isn't a real department in this organization", async () => {
    departmentFindFirstMock.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "dept_a") return { id: "dept_a", name: "Engineering" };
      return null; // the parent lookup inside parseDepartmentInput
    });

    const result = await updateDepartment(
      undefined,
      formDataFor({ departmentId: "dept_a", parentId: "dept_missing" })
    );

    expect(result).toEqual({ error: "Parent department not found." });
  });
});

describe("updateDepartment — hierarchy cycle prevention", () => {
  // Chain: dept_a (root) -> dept_b -> dept_c. Retargeting dept_a's parent to
  // dept_c (its own descendant) must be rejected, or a tree render/traversal
  // would loop forever.
  const chain: Record<string, { parentId: string | null }> = {
    dept_a: { parentId: null },
    dept_b: { parentId: "dept_a" },
    dept_c: { parentId: "dept_b" },
  };

  beforeEach(() => {
    departmentFindFirstMock.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "dept_a") return { id: "dept_a", name: "Engineering" };
      if (chain[where.id]) return { id: where.id }; // parent-exists check
      return null;
    });
    departmentFindUniqueMock.mockImplementation(({ where }: { where: { id: string } }) =>
      chain[where.id] ? { parentId: chain[where.id].parentId } : null
    );
  });

  it("rejects retargeting a department under its own descendant", async () => {
    const result = await updateDepartment(
      undefined,
      formDataFor({ departmentId: "dept_a", parentId: "dept_c" })
    );

    expect(result).toEqual({
      error: "That parent sits underneath this department — it would create a loop.",
    });
    expect(departmentUpdateMock).not.toHaveBeenCalled();
  });

  it("allows retargeting to a department outside its own subtree", async () => {
    departmentFindFirstMock.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "dept_c") return { id: "dept_c", name: "Support" };
      if (where.id === "dept_a") return { id: "dept_a" }; // parent-exists check
      return null;
    });
    departmentFindUniqueMock.mockImplementation(({ where }: { where: { id: string } }) =>
      where.id === "dept_a" ? { parentId: null } : null
    );
    departmentUpdateMock.mockResolvedValue({});

    const result = await updateDepartment(
      undefined,
      formDataFor({ departmentId: "dept_c", parentId: "dept_a" })
    );

    expect(result).toEqual({ success: true });
    expect(departmentUpdateMock).toHaveBeenCalled();
  });

  it("surfaces the duplicate-code error on update too", async () => {
    departmentUpdateMock.mockRejectedValue(uniqueConstraintError());

    const result = await updateDepartment(
      undefined,
      formDataFor({ departmentId: "dept_a", parentId: "none" })
    );

    expect(result).toEqual({ error: "A department with that code already exists." });
  });
});
