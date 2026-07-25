"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideApproval } from "@/lib/actions/approvals";
import { Check, X } from "lucide-react";

export function DecideClaimButtons({ approvalId }: { approvalId: string }) {
  const [isPending, startTransition] = useTransition();

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      try {
        await decideApproval(approvalId, decision);
        toast.success(decision === "APPROVED" ? "Claim approved" : "Claim rejected");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not decide claim");
      }
    });
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button
        size="icon-sm"
        variant="outline"
        disabled={isPending}
        className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
        onClick={() => decide("APPROVED")}
      >
        <Check className="size-3.5" />
      </Button>
      <Button
        size="icon-sm"
        variant="outline"
        disabled={isPending}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => decide("REJECTED")}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
