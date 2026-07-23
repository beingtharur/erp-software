export function calculateNetPay({
  basicSalary,
  allowances,
  baseDeductions,
  unpaidLeaveDays,
}: {
  basicSalary: number;
  allowances: number;
  baseDeductions: number;
  unpaidLeaveDays: number;
}) {
  const perDayRate = basicSalary / 30;
  const unpaidLeaveDeduction = Math.round(perDayRate * unpaidLeaveDays);
  const deductions = baseDeductions + unpaidLeaveDeduction;
  const netPay = basicSalary + allowances - deductions;
  return { deductions, netPay, unpaidLeaveDeduction };
}
