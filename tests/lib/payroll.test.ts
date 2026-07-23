import { describe, expect, it } from "vitest";
import { calculateNetPay } from "@/lib/payroll";

describe("calculateNetPay", () => {
  it("matches the flat baseline when there's no unpaid leave", () => {
    const result = calculateNetPay({
      basicSalary: 30000,
      allowances: 9600,
      baseDeductions: 2700,
      unpaidLeaveDays: 0,
    });
    expect(result).toEqual({ deductions: 2700, netPay: 36900, unpaidLeaveDeduction: 0 });
  });

  it("deducts a per-day share of basic salary for each unpaid leave day", () => {
    const result = calculateNetPay({
      basicSalary: 30000,
      allowances: 9600,
      baseDeductions: 2700,
      unpaidLeaveDays: 3,
    });
    // 30000 / 30 = 1000/day * 3 days = 3000
    expect(result.unpaidLeaveDeduction).toBe(3000);
    expect(result.deductions).toBe(5700);
    expect(result.netPay).toBe(30000 + 9600 - 5700);
  });

  it("rounds fractional per-day deductions to the nearest rupee", () => {
    const result = calculateNetPay({
      basicSalary: 32000,
      allowances: 0,
      baseDeductions: 0,
      unpaidLeaveDays: 1,
    });
    // 32000 / 30 = 1066.67 -> rounds to 1067
    expect(result.unpaidLeaveDeduction).toBe(1067);
  });

  it("never produces a negative net pay from deductions alone going unchecked here (caller's responsibility, but sanity-check the arithmetic)", () => {
    const result = calculateNetPay({
      basicSalary: 10000,
      allowances: 0,
      baseDeductions: 0,
      unpaidLeaveDays: 30,
    });
    expect(result.netPay).toBe(0);
  });
});
