import type { getPayrollRecordDetail } from "@/lib/queries/hrms";
import type { ExportColumn } from "@/lib/export/workbook";

export type PayslipRecord = NonNullable<Awaited<ReturnType<typeof getPayrollRecordDetail>>>;

export type PayslipLineItem = {
  section: "Earning" | "Deduction";
  component: string;
  amount: number;
};

export type PayslipBreakdown = {
  rows: PayslipLineItem[];
  grossEarnings: number;
  totalDeductions: number;
  /** True when the reconciled leave deduction came out negative (stale/bad
   * salary-structure data) and had to be clamped to 0 — callers should log
   * this discrepancy rather than silently showing a wrong number. */
  hasDiscrepancy: boolean;
  discrepancyDetail?: string;
};

// A payroll record only has a real PF/ESI/tax breakdown when it's linked to
// the SalaryStructure that was active when it was generated (salaryStructureId,
// fixed at generation time — see getPayrollRecordDetail). Seed data and any
// pre-structure-era record has none, so this must degrade to the flat
// basic/allowances/deductions the record itself stores, not fabricate a
// breakdown from nothing.
export function buildPayslipBreakdown(record: PayslipRecord): PayslipBreakdown {
  const structure = record.salaryStructure;

  if (!structure) {
    const rows: PayslipLineItem[] = [
      { section: "Earning", component: "Basic Salary", amount: record.basicSalary },
      { section: "Earning", component: "Allowances", amount: record.allowances },
      { section: "Earning", component: "Bonus", amount: record.bonus },
      { section: "Earning", component: "Overtime Pay", amount: record.overtimePay },
      { section: "Deduction", component: "Deductions", amount: record.deductions },
    ];
    const grossEarnings = record.basicSalary + record.allowances + record.bonus + record.overtimePay;
    return { rows, grossEarnings, totalDeductions: record.deductions, hasDiscrepancy: false };
  }

  const statutoryDeductions =
    structure.pf + structure.esi + structure.professionalTax + structure.incomeTax;
  const rawLeaveDeduction = record.deductions - statutoryDeductions;
  const hasDiscrepancy = rawLeaveDeduction < 0;
  const leaveDeduction = hasDiscrepancy ? 0 : rawLeaveDeduction;

  const rows: PayslipLineItem[] = [
    { section: "Earning", component: "Basic Salary", amount: record.basicSalary },
    { section: "Earning", component: "HRA", amount: structure.hra },
    { section: "Earning", component: "DA", amount: structure.da },
    { section: "Earning", component: "Travel Allowance", amount: structure.travelAllowance },
    { section: "Earning", component: "Medical Allowance", amount: structure.medicalAllowance },
    { section: "Earning", component: "Special Allowance", amount: structure.specialAllowance },
    { section: "Earning", component: "Bonus", amount: record.bonus },
    { section: "Earning", component: "Overtime Pay", amount: record.overtimePay },
    { section: "Deduction", component: "Provident Fund (PF)", amount: structure.pf },
    { section: "Deduction", component: "ESI", amount: structure.esi },
    { section: "Deduction", component: "Professional Tax", amount: structure.professionalTax },
    { section: "Deduction", component: "Income Tax (TDS)", amount: structure.incomeTax },
    { section: "Deduction", component: "Leave Deduction", amount: leaveDeduction },
  ];
  const grossEarnings =
    record.basicSalary +
    structure.hra +
    structure.da +
    structure.travelAllowance +
    structure.medicalAllowance +
    structure.specialAllowance +
    record.bonus +
    record.overtimePay;
  const totalDeductions = statutoryDeductions + leaveDeduction;

  return {
    rows,
    grossEarnings,
    totalDeductions,
    hasDiscrepancy,
    discrepancyDetail: hasDiscrepancy
      ? `computed leave deduction ${rawLeaveDeduction} is negative (stored deductions=${record.deductions}, statutory=${statutoryDeductions}); clamped to 0`
      : undefined,
  };
}

export const payslipColumns: ExportColumn<PayslipLineItem>[] = [
  { header: "Section", value: (r) => r.section },
  { header: "Component", value: (r) => r.component },
  { header: "Amount", value: (r) => r.amount },
];
