"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditEmployeeSheet } from "@/components/hrms/edit-employee-sheet";
import { NewSalaryStructureSheet } from "@/components/hrms/new-salary-structure-sheet";
import { deleteEmployee } from "@/lib/actions/hrms";
import type { DepartmentOption } from "@/components/departments/department-select";
import { MoreVertical, Pencil, Wallet, Trash2 } from "lucide-react";

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
 * Per-row actions for the employee list, collapsed into one menu rather than a
 * growing row of icon buttons.
 *
 * The sheets are rendered here and opened by state rather than by their own
 * triggers: a DropdownMenuItem unmounts the moment the menu closes, so a
 * trigger living inside it could never keep a sheet open. Both sheets already
 * support being controlled (same pattern as NewSiteVisitSheet).
 */
export function EmployeeRowMenu({
  employee,
  managerOptions,
  departments,
  salaryStructure,
  canDelete,
}: {
  employee: {
    id: string;
    name: string;
    departmentId: string | null;
    phone: string;
    baseLocation: string;
    status: string;
    reportingToId: string | null;
  };
  managerOptions: { id: string; name: string }[];
  departments: DepartmentOption[];
  salaryStructure: SalaryStructure | null;
  canDelete: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(`Delete employee "${employee.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteEmployee(employee.id);
        toast.success("Employee deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete employee");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button size="icon-sm" variant="ghost" title="Actions" disabled={isPending} />}
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit employee
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSalaryOpen(true)}>
              <Wallet />
              {salaryStructure ? "Change salary structure" : "Set up salary"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 />
                Delete employee
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditEmployeeSheet
        employee={employee}
        managerOptions={managerOptions}
        departments={departments}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <NewSalaryStructureSheet
        employeeId={employee.id}
        current={salaryStructure}
        open={salaryOpen}
        onOpenChange={setSalaryOpen}
      />
    </>
  );
}
