"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { decideLeaveRequest } from "@/lib/actions/hrms";

export function LeaveDecisionButtons({ leaveId }: { leaveId: string }) {
  const [isPending, startTransition] = useTransition();

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      try {
        await decideLeaveRequest(leaveId, decision);
        toast.success(decision === "APPROVED" ? "Leave approved" : "Leave rejected");
      } catch {
        toast.error("Could not update leave request");
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
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
