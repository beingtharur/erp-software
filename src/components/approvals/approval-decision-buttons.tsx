"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { decideApproval } from "@/lib/actions/approvals";

export function ApprovalDecisionButtons({ approvalId }: { approvalId: string }) {
  const [isPending, startTransition] = useTransition();

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      try {
        await decideApproval(approvalId, decision);
        toast.success(decision === "APPROVED" ? "Approved" : "Rejected");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not record decision");
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
        onClick={() => decide("APPROVED")}
      >
        <Check className="size-3.5" />
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => decide("REJECTED")}
      >
        <X className="size-3.5" />
        Reject
      </Button>
    </div>
  );
}
