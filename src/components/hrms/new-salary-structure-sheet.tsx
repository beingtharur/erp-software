"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { createSalaryStructure } from "@/lib/actions/hrms";
import { Plus } from "lucide-react";

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

const FIELDS: { name: keyof SalaryStructure; label: string; required?: boolean }[] = [
  { name: "basicSalary", label: "Basic Salary (₹)", required: true },
  { name: "hra", label: "HRA (₹)" },
  { name: "da", label: "DA (₹)" },
  { name: "travelAllowance", label: "Travel Allowance (₹)" },
  { name: "medicalAllowance", label: "Medical Allowance (₹)" },
  { name: "specialAllowance", label: "Special Allowance (₹)" },
  { name: "bonus", label: "Bonus (₹)" },
  { name: "pf", label: "PF (₹)" },
  { name: "esi", label: "ESI (₹)" },
  { name: "professionalTax", label: "Professional Tax (₹)" },
  { name: "incomeTax", label: "Income Tax (₹)" },
  { name: "overtimeRate", label: "Overtime Rate (₹/hr)" },
];

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function NewSalaryStructureSheet({
  employeeId,
  current,
}: {
  employeeId: string;
  current?: SalaryStructure | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createSalaryStructure, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Salary structure updated");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" variant="outline" />}>
        <Plus />
        {current ? "Update Salary" : "Set Up Salary"}
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{current ? "Update salary structure" : "Set up salary structure"}</SheetTitle>
          <SheetDescription>
            Takes effect from the date below. The previous structure is kept for history — past payroll
            keeps whatever was active when it was generated.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="employeeId" value={employeeId} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="effectiveFrom">Effective from</Label>
            <Input
              id="effectiveFrom"
              name="effectiveFrom"
              type="date"
              required
              defaultValue={toDateInputValue(new Date())}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((field) => (
              <div key={field.name} className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="number"
                  min={0}
                  step="any"
                  required={field.required}
                  defaultValue={current?.[field.name] ?? 0}
                />
              </div>
            ))}
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save salary structure"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
