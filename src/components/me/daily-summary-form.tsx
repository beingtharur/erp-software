"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitDailySummary } from "@/lib/actions/me";

type ExistingSummary = {
  completedNote: string | null;
  inProgressNote: string | null;
  pendingNote: string | null;
  blockersNote: string | null;
  updatesNote: string | null;
  nextDayPlan: string | null;
} | null;

export function DailySummaryForm({ existing }: { existing: ExistingSummary }) {
  const [state, formAction, pending] = useActionState(submitDailySummary, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(existing ? "Summary updated" : "Summary submitted");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="completedNote">Completed today</Label>
          <Textarea id="completedNote" name="completedNote" rows={2} defaultValue={existing?.completedNote ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inProgressNote">In progress</Label>
          <Textarea id="inProgressNote" name="inProgressNote" rows={2} defaultValue={existing?.inProgressNote ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pendingNote">Pending</Label>
          <Textarea id="pendingNote" name="pendingNote" rows={2} defaultValue={existing?.pendingNote ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="blockersNote">Blockers</Label>
          <Textarea id="blockersNote" name="blockersNote" rows={2} defaultValue={existing?.blockersNote ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="updatesNote">Important updates</Label>
          <Textarea id="updatesNote" name="updatesNote" rows={2} defaultValue={existing?.updatesNote ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nextDayPlan">Next-day plan</Label>
          <Textarea id="nextDayPlan" name="nextDayPlan" rows={2} defaultValue={existing?.nextDayPlan ?? ""} />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : existing ? "Update summary" : "Submit summary"}
      </Button>
    </form>
  );
}
