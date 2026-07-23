"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markPaymentPaid } from "@/lib/actions/vendor";

export function MarkPaidButton({ paymentId }: { paymentId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await markPaymentPaid(paymentId, "NEFT");
            toast.success("Payment marked as paid");
          } catch {
            toast.error("Could not update payment");
          }
        })
      }
    >
      {isPending ? "Updating…" : "Mark Paid"}
    </Button>
  );
}
