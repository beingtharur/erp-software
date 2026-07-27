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
import { Wrench } from "lucide-react";
import { completeAmcService } from "@/lib/actions/crm";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function LogAmcServiceButton({ amcContractId }: { amcContractId: string }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [serviceDate, setServiceDate] = useState(() => toDateInputValue(new Date()));
  const [notes, setNotes] = useState("");

  function logService() {
    startTransition(async () => {
      try {
        await completeAmcService(amcContractId, serviceDate, notes);
        toast.success("Service logged");
        setOpen(false);
        setNotes("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not log service");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
        <Wrench className="size-3" />
        Log Service
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log AMC service</DialogTitle>
          <DialogDescription>
            Records the service date and recalculates the next scheduled visit.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serviceDate">Service date</Label>
            <Input
              id="serviceDate"
              type="date"
              value={serviceDate}
              max={toDateInputValue(new Date())}
              onChange={(e) => setServiceDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serviceNotes">Notes (optional)</Label>
            <Textarea
              id="serviceNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was serviced, any parts replaced…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button disabled={isPending || !serviceDate} onClick={logService}>
            Log service
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
