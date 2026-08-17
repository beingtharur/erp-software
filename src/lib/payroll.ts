// Numeric day-value per attendance status, for attendance reports and future
// payroll calculations (e.g. a per-day-rate proration that isn't limited to
// just UNPAID leave). ON_LEAVE is valued off the covering leave type — unpaid
// leave contributes 0, every other leave type is paid in full — matching the
// same UNPAID-only deduction rule calculateNetPay already applies.
export function attendanceDayValue(
  status: "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE" | "HOLIDAY",
  leaveType?: string | null
): number {
  switch (status) {
    case "PRESENT":
      return 1;
    case "HALF_DAY":
      return 0.5;
    case "HOLIDAY":
      return 1;
    case "ON_LEAVE":
      return leaveType === "UNPAID" ? 0 : 1;
    case "ABSENT":
    default:
      return 0;
  }
}

export function calculateSalaryComponents(structure: {
  hra: number;
  da: number;
  travelAllowance: number;
  medicalAllowance: number;
  specialAllowance: number;
  pf: number;
  esi: number;
  professionalTax: number;
  incomeTax: number;
}) {
  const allowances =
    structure.hra + structure.da + structure.travelAllowance + structure.medicalAllowance + structure.specialAllowance;
  const statutoryDeductions = structure.pf + structure.esi + structure.professionalTax + structure.incomeTax;
  return { allowances, statutoryDeductions };
}

export function calculateNetPay({
  basicSalary,
  allowances,
  bonus = 0,
  overtimePay = 0,
  baseDeductions,
  unpaidLeaveDays,
}: {
  basicSalary: number;
  allowances: number;
  bonus?: number;
  overtimePay?: number;
  baseDeductions: number;
  unpaidLeaveDays: number;
}) {
  const perDayRate = basicSalary / 30;
  const unpaidLeaveDeduction = Math.round(perDayRate * unpaidLeaveDays);
  const deductions = baseDeductions + unpaidLeaveDeduction;
  const netPay = basicSalary + allowances + bonus + overtimePay - deductions;
  return { deductions, netPay, unpaidLeaveDeduction };
}
