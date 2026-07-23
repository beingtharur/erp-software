"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { processPayroll } from "@/lib/actions/hrms";

export function ProcessPayrollButton({ payrollId }: { payrollId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await processPayroll(payrollId);
            toast.success("Payroll processed");
          } catch {
            toast.error("Could not process payroll");
          }
        })
      }
    >
      {isPending ? "Processing…" : "Process"}
    </Button>
  );
}
