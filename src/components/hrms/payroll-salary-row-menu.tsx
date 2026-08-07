"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewSalaryStructureSheet } from "@/components/hrms/new-salary-structure-sheet";
import { MoreVertical, Wallet } from "lucide-react";

type SalaryStructure = {
  basicSalary: number;
  hra: number;
  da: number;
  travelAllowance: number;
  medicalAllowance: number;
  specialAllowance: number;
  bonus: number;
  pf: number;
  esi: number;
  professionalTax: number;
  incomeTax: number;
  overtimeRate: number;
};

/**
 * Per-row 3-dot menu for the Payroll table's Salary Structure column — same
 * controlled-sheet pattern as EmployeeRowMenu, kept separate since this one
 * only ever needs the single salary action.
 *
 * `current === null` (rendering "Set up Salary") is a real, reachable state
 * here, not dead code: `generatePayroll` itself never creates a PayrollRecord
 * without an active SalaryStructure, but `prisma/seed.ts` does — it inserts
 * PayrollRecord rows directly with hardcoded role-based figures and no
 * matching SalaryStructure, so any employee whose payroll history predates
 * ever having one set up (most of the seed data) legitimately shows this
 * state. Don't collapse this to always "Change Salary Structure".
 */
export function PayrollSalaryRowMenu({
  employeeId,
  current,
}: {
  employeeId: string;
  current: SalaryStructure | null;
}) {
  const [salaryOpen, setSalaryOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" title="Actions" />}>
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-max whitespace-nowrap">
          <DropdownMenuItem onClick={() => setSalaryOpen(true)}>
            <Wallet />
            {current ? "Change Salary Structure" : "Set up Salary"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewSalaryStructureSheet
        employeeId={employeeId}
        current={current}
        open={salaryOpen}
        onOpenChange={setSalaryOpen}
      />
    </>
  );
}
