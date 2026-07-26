"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { rescheduleSiteVisit } from "@/lib/actions/crm";

export function RescheduleVisitSheet({
  visitId,
  open,
  onOpenChange,
}: {
  visitId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [reason, setReason] = useState("");

  function submit() {
    if (!date || !reason.trim()) return;
    startTransition(async () => {
      try {
        await rescheduleSiteVisit(visitId, `${date}T${time}`, reason);
        toast.success("Visit rescheduled");
        onOpenChange(false);
        setDate("");
        setReason("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not reschedule visit");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule visit</DialogTitle>
          <DialogDescription>Pick a new date and explain why it&apos;s moving.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reschedule-date">New date</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reschedule-time">New time</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reschedule-reason">Reason</Label>
            <Textarea
              id="reschedule-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. customer asked to postpone"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button disabled={isPending || !date || !reason.trim()} onClick={submit}>
            {isPending ? "Rescheduling…" : "Reschedule visit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
