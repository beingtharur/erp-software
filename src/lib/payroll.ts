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
