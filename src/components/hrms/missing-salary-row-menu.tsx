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

/**
 * Per-employee 3-dot menu for the Payroll page's "missing salary structure"
 * list — same controlled-sheet pattern as EmployeeRowMenu, kept separate
 * since this list only ever needs the one action.
 */
export function MissingSalaryRowMenu({ employeeId }: { employeeId: string }) {
  const [salaryOpen, setSalaryOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" title="Actions" />}>
          <MoreVertical className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setSalaryOpen(true)}>
            <Wallet />
            Set up salary
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewSalaryStructureSheet employeeId={employeeId} open={salaryOpen} onOpenChange={setSalaryOpen} />
    </>
  );
}
