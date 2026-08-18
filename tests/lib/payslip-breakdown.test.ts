import { describe, expect, it } from "vitest";
import { buildPayslipBreakdown } from "@/lib/export/payslip";

function amountOf(rows: { component: string; amount: number }[], component: string) {
  const row = rows.find((r) => r.component === component);
  if (!row) throw new Error(`${component} row missing`);
  return row.amount;
}

describe("buildPayslipBreakdown — no linked salary structure (legacy/seed records)", () => {
  const record = {
    basicSalary: 45000,
    allowances: 14400,
    bonus: 0,
    overtimePay: 0,
    deductions: 4050,
    salaryStructure: null,
  } as never;

  it("falls back to the flat basic/allowances/deductions the record itself stores", () => {
    const result = buildPayslipBreakdown(record);
    expect(amountOf(result.rows, "Basic Salary")).toBe(45000);
    expect(amountOf(result.rows, "Allowances")).toBe(14400);
    expect(amountOf(result.rows, "Deductions")).toBe(4050);
    expect(result.grossEarnings).toBe(59400);
    expect(result.totalDeductions).toBe(4050);
    expect(result.hasDiscrepancy).toBe(false);
  });
});

describe("buildPayslipBreakdown — linked salary structure", () => {
  const structure = {
    hra: 10000,
    da: 2000,
    travelAllowance: 1500,
    medicalAllowance: 1000,
    specialAllowance: 500,
    pf: 1800,
    esi: 400,
    professionalTax: 200,
    incomeTax: 1000,
  };

  it("reconciles Leave Deduction as stored deductions minus the statutory total", () => {
    // statutory = 1800+400+200+1000 = 3400; stored deductions include a
    // further ₹660 the real processPayroll run added for unpaid leave.
    const record = {
      basicSalary: 50000,
      bonus: 1000,
      overtimePay: 500,
      deductions: 4060,
      salaryStructure: structure,
    } as never;

    const result = buildPayslipBreakdown(record);
    expect(amountOf(result.rows, "Leave Deduction")).toBe(660);
    expect(amountOf(result.rows, "Provident Fund (PF)")).toBe(1800);
    expect(amountOf(result.rows, "Income Tax (TDS)")).toBe(1000);
    expect(result.totalDeductions).toBe(4060);
    expect(result.hasDiscrepancy).toBe(false);
  });

  it("shows Leave Deduction as 0 for a still-PENDING record with no leave applied yet", () => {
    // Before processPayroll runs, stored deductions equal the statutory total
    // exactly — nothing to reconcile.
    const record = {
      basicSalary: 50000,
      bonus: 0,
      overtimePay: 0,
      deductions: 3400,
      salaryStructure: structure,
    } as never;

    const result = buildPayslipBreakdown(record);
    expect(amountOf(result.rows, "Leave Deduction")).toBe(0);
    expect(result.hasDiscrepancy).toBe(false);
  });

  it("clamps a negative reconciliation to 0 and flags it as a discrepancy instead of showing a wrong number", () => {
    // Stale data: stored deductions are less than the structure's own
    // statutory total (e.g. the structure was edited upward afterwards).
    const record = {
      basicSalary: 50000,
      bonus: 0,
      overtimePay: 0,
      deductions: 2000,
      salaryStructure: structure,
    } as never;

    const result = buildPayslipBreakdown(record);
    expect(amountOf(result.rows, "Leave Deduction")).toBe(0);
    expect(result.hasDiscrepancy).toBe(true);
    expect(result.discrepancyDetail).toContain("negative");
  });

  it("computes Gross Earnings from basic salary plus every structure allowance component", () => {
    const record = {
      basicSalary: 50000,
      bonus: 1000,
      overtimePay: 500,
      deductions: 3400,
      salaryStructure: structure,
    } as never;

    const result = buildPayslipBreakdown(record);
    expect(result.grossEarnings).toBe(50000 + 10000 + 2000 + 1500 + 1000 + 500 + 1000 + 500);
  });
});
