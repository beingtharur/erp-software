"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Check, X } from "lucide-react";
import { approvePayment, rejectPayment } from "@/lib/actions/platform-admin";

export function PaymentReviewActions({ paymentId }: { paymentId: string }) {
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    startTransition(async () => {
      try {
        await approvePayment(paymentId);
        toast.success("Payment approved — subscription activated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not approve payment");
      }
    });
  }

  function reject() {
    startTransition(async () => {
      try {
        await rejectPayment(paymentId, reason);
        toast.success("Payment rejected");
        setRejectOpen(false);
        setReason("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not reject payment");
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
        onClick={approve}
      >
        <Check className="size-3.5" />
        Approve
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setRejectOpen(true)}
        >
          <X className="size-3.5" />
          Reject
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment</DialogTitle>
            <DialogDescription>
              Provide a reason — this is shown to the organization so they know what to fix.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. UTR not found, incorrect amount, duplicate transaction…"
            rows={3}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={isPending || !reason.trim()}
              onClick={reject}
            >
              Reject payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
