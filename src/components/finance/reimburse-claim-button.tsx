"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Banknote } from "lucide-react";
import { markExpenseClaimReimbursed } from "@/lib/actions/finance";

export function ReimburseClaimButton({ claimId }: { claimId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await markExpenseClaimReimbursed(claimId);
        toast.success("Marked reimbursed");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update claim");
      }
    });
  }

  return (
    <Button size="xs" variant="outline" disabled={isPending} onClick={handleClick}>
      <Banknote className="size-3" />
      Mark reimbursed
    </Button>
  );
}
