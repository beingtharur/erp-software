"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generatePayroll } from "@/lib/actions/hrms";

const MONTH_LABEL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function GeneratePayrollButton() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [isPending, startTransition] = useTransition();

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(String);

  function generate() {
    startTransition(async () => {
      try {
        const result = await generatePayroll(Number(month), Number(year));
        if (result.created > 0) {
          toast.success(`Generated payroll for ${result.created} employee${result.created === 1 ? "" : "s"}`);
        }
        if (result.skippedNoSalaryStructure > 0) {
          toast.error(
            `${result.skippedNoSalaryStructure} employee${result.skippedNoSalaryStructure === 1 ? "" : "s"} skipped — no salary structure set up (see the notice above).`
          );
        } else if (result.created === 0 && result.skippedExisting > 0) {
          toast.error("Payroll for this period already exists for every active employee.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not generate payroll");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={month} onValueChange={(v) => v && setMonth(v as string)}>
        <SelectTrigger size="sm" className="w-36">
          <SelectValue>{(value: unknown) => MONTH_LABEL[Number(value) - 1] ?? "Month"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MONTH_LABEL.map((label, i) => (
            <SelectItem key={label} value={String(i + 1)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={year} onValueChange={(v) => v && setYear(v as string)}>
        <SelectTrigger size="sm" className="w-24">
          <SelectValue>{(value: unknown) => String(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((y) => (
            <SelectItem key={y} value={y}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={isPending} onClick={generate}>
        {isPending ? "Generating…" : "Generate payroll"}
      </Button>
    </div>
  );
}
