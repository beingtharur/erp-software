"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unlockPayroll } from "@/lib/actions/hrms";
import { LockOpen } from "lucide-react";

export function UnlockPayrollButton({ payrollId }: { payrollId: string }) {
  const [isPending, startTransition] = useTransition();

  function onUnlock() {
    if (!window.confirm("Unlock this payroll for reprocessing?")) return;
    startTransition(async () => {
      try {
        await unlockPayroll(payrollId);
        toast.success("Payroll unlocked");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not unlock payroll");
      }
    });
  }

  return (
    <Button size="icon-sm" variant="outline" disabled={isPending} title="Unlock" onClick={onUnlock}>
      <LockOpen className="size-3.5" />
    </Button>
  );
}
