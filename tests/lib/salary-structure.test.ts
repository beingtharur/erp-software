import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// createSalaryStructure is reachable from two surfaces: the employee's own
// profile (pre-existing) and the payroll table's row menu (added alongside
// PayrollSalaryRowMenu). Both need to see a fresh "current" structure after a
// save, so this pins that both revalidatePath calls actually happen — the
// payroll one was missing until now, which left the payroll page showing a
// stale label/prefill after a change made from its own row menu.

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const requireRoleMock = vi.fn();
const getCurrentUserMock = vi.fn();
vi.mock("@/lib/dal", () => ({
  requireRole: requireRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

const employeeFindFirstMock = vi.fn();
const transactionMock = vi.fn();
const salaryStructureUpdateManyMock = vi.fn();
const salaryStructureCreateMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    employee: { findFirst: employeeFindFirstMock },
    salaryStructure: {
      updateMany: salaryStructureUpdateManyMock,
      create: salaryStructureCreateMock,
    },
    $transaction: transactionMock,
  },
}));

const { createSalaryStructure } = await import("@/lib/actions/hrms");

const ORG = "org_1";
const EMPLOYEE_ID = "emp_1";

function formDataFor(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("employeeId", EMPLOYEE_ID);
  fd.set("effectiveFrom", "2026-08-01");
  fd.set("basicSalary", "50000");
  fd.set("hra", "10000");
  fd.set("da", "0");
  fd.set("travelAllowance", "0");
  fd.set("medicalAllowance", "0");
  fd.set("specialAllowance", "0");
  fd.set("bonus", "0");
  fd.set("pf", "1800");
  fd.set("esi", "0");
  fd.set("professionalTax", "0");
  fd.set("incomeTax", "0");
  fd.set("overtimeRate", "0");
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  requireRoleMock.mockResolvedValue(undefined);
  getCurrentUserMock.mockResolvedValue({ organizationId: ORG });
  employeeFindFirstMock.mockResolvedValue({ id: EMPLOYEE_ID });
  transactionMock.mockResolvedValue([{}, {}]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createSalaryStructure — revalidation", () => {
  it("revalidates both the employee profile and the payroll page on success", async () => {
    const result = await createSalaryStructure(undefined, formDataFor());

    expect(result).toEqual({ success: true });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/hrms/employees/${EMPLOYEE_ID}`);
    expect(revalidatePathMock).toHaveBeenCalledWith("/hrms/payroll");
    expect(revalidatePathMock).toHaveBeenCalledTimes(2);
  });

  it("does not revalidate anything when validation fails", async () => {
    const result = await createSalaryStructure(undefined, formDataFor({ basicSalary: "0" }));

    expect(result).toEqual({ error: "Enter a valid basic salary." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("does not revalidate anything when the employee isn't found in this organization", async () => {
    employeeFindFirstMock.mockResolvedValue(null);

    const result = await createSalaryStructure(undefined, formDataFor());

    expect(result).toEqual({ error: "Employee not found." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
