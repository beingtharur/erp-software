"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { recordAmcService } from "@/lib/actions/crm";
import { Wrench } from "lucide-react";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Previously there was no way to ever record a completed service visit, so
// Last/Next Service Date could only ever be set once (at contract creation)
// and stayed frozen forever after that.
export function RecordAmcServiceButton({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false);
  const [serviceDate, setServiceDate] = useState(toDateInputValue(new Date()));
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        await recordAmcService(contractId, serviceDate, nextServiceDate);
        toast.success("Service recorded");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not record service");
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="icon-xs" variant="outline" title="Record service" />}>
        <Wrench className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`service-${contractId}`}>Service date</Label>
            <Input
              id={`service-${contractId}`}
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`next-${contractId}`}>Next service due (optional)</Label>
            <Input
              id={`next-${contractId}`}
              type="date"
              value={nextServiceDate}
              onChange={(e) => setNextServiceDate(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={isPending} onClick={submit}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
