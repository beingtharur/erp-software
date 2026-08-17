"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applyLeave } from "@/lib/actions/me";
import { Plus } from "lucide-react";

const LEAVE_TYPE_LABEL: Record<string, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  EARNED: "Earned",
  UNPAID: "Unpaid",
  HALF_DAY: "Half Day",
};

const HALF_DAY_PERIOD_LABEL: Record<string, string> = {
  FIRST_HALF: "First Half",
  SECOND_HALF: "Second Half",
  CUSTOM: "Custom",
};

export function ApplyLeaveSheet() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("CASUAL");
  const [halfDayPeriod, setHalfDayPeriod] = useState("FIRST_HALF");
  const [state, formAction, pending] = useActionState(applyLeave, undefined);
  const isHalfDay = type === "HALF_DAY";

  useEffect(() => {
    if (state?.success) {
      toast.success("Leave request submitted");
      setOpen(false);
      setType("CASUAL");
      setHalfDayPeriod("FIRST_HALF");
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus />
        Apply for leave
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Apply for leave</SheetTitle>
          <SheetDescription>Submit a leave request for HR approval.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Leave type</Label>
            <Select name="type" required value={type} onValueChange={(v) => setType(String(v ?? "CASUAL"))}>
              <SelectTrigger id="type" className="w-full">
                <SelectValue placeholder="Select type">
                  {(value: unknown) => LEAVE_TYPE_LABEL[value as string] ?? "Casual"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASUAL">Casual</SelectItem>
                <SelectItem value="SICK">Sick</SelectItem>
                <SelectItem value="EARNED">Earned</SelectItem>
                <SelectItem value="UNPAID">Unpaid</SelectItem>
                <SelectItem value="HALF_DAY">Half Day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isHalfDay ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startDate">Date</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="halfDayPeriod">Period</Label>
                <Select
                  name="halfDayPeriod"
                  required
                  value={halfDayPeriod}
                  onValueChange={(v) => setHalfDayPeriod(String(v ?? "FIRST_HALF"))}
                >
                  <SelectTrigger id="halfDayPeriod" className="w-full">
                    <SelectValue placeholder="Select period">
                      {(value: unknown) => HALF_DAY_PERIOD_LABEL[value as string] ?? "First Half"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIRST_HALF">First Half</SelectItem>
                    <SelectItem value="SECOND_HALF">Second Half</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {halfDayPeriod === "CUSTOM" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="halfDayStartTime">From</Label>
                    <Input id="halfDayStartTime" name="halfDayStartTime" type="time" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="halfDayEndTime">To</Label>
                    <Input id="halfDayEndTime" name="halfDayEndTime" type="time" required />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="endDate">End date</Label>
                <Input id="endDate" name="endDate" type="date" required />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" name="reason" placeholder="Brief reason…" rows={3} required />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit request"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
