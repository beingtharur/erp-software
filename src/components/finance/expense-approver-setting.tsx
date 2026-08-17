"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { updateExpenseApproverRole } from "@/lib/actions/finance";

const ROLE_LABEL: Record<string, string> = {
  DEFAULT: "Finance (default)",
  ADMIN: "Admin",
  HR: "HR",
  FINANCE: "Finance",
};

type ApproverRoleValue = "DEFAULT" | "ADMIN" | "HR" | "FINANCE";

// Admin-only control for Organization.expenseApproverRole — lets a small org
// without a dedicated Finance-role user (e.g. one where Admin also handles
// Finance) point new expense claims at whichever role actually reviews them,
// instead of them silently routing to a role nobody holds.
export function ExpenseApproverSetting({ current }: { current: string | null }) {
  const [isPending, startTransition] = useTransition();
  const value = current ?? "DEFAULT";

  function onChange(next: string) {
    startTransition(async () => {
      try {
        await updateExpenseApproverRole(next as ApproverRoleValue);
        toast.success("Expense approver updated");
      } catch {
        toast.error("Could not update the expense approver");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="expense-approver" className="text-xs text-muted-foreground whitespace-nowrap">
        Expense approver
      </Label>
      <Select value={value} onValueChange={(v) => onChange(String(v ?? "DEFAULT"))} disabled={isPending}>
        <SelectTrigger id="expense-approver" className="w-44">
          <SelectValue>{(v: unknown) => ROLE_LABEL[v as string] ?? "Finance (default)"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="DEFAULT">Finance (default)</SelectItem>
          <SelectItem value="ADMIN">Admin</SelectItem>
          <SelectItem value="HR">HR</SelectItem>
          <SelectItem value="FINANCE">Finance</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
