"use client";

import { useActionState, useEffect } from "react";
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
  SheetClose,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeSiteVisit } from "@/lib/actions/crm";

const OUTCOME_LABEL: Record<string, string> = {
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not Interested",
  NEEDS_QUOTATION: "Needs Quotation",
  FOLLOW_UP_REQUIRED: "Follow-up Required",
  NO_DECISION: "No Decision",
  OTHER: "Other",
};

const RECOMMENDED_ACTION_LABEL: Record<string, string> = {
  CREATE_QUOTATION: "Create Quotation",
  SCHEDULE_FOLLOW_UP: "Schedule Follow-up",
  TECHNICAL_REVIEW: "Technical Review",
  AWAIT_CUSTOMER: "Await Customer",
  CLOSE_LEAD: "Close Lead",
  OTHER: "Other",
};

function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function CompleteVisitSheet({
  visitId,
  followUpDate,
  open,
  onOpenChange,
}: {
  visitId: string;
  followUpDate?: Date | string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(completeSiteVisit, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Visit completed");
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Complete visit</SheetTitle>
          <SheetDescription>Record what happened and what should happen next.</SheetDescription>
        </SheetHeader>
        <form
          key={open ? "open" : "closed"}
          action={formAction}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <input type="hidden" name="visitId" value={visitId} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="outcome">Outcome</Label>
            <Select name="outcome" required>
              <SelectTrigger id="outcome" className="w-full">
                <SelectValue placeholder="Select outcome">
                  {(value: unknown) => OUTCOME_LABEL[value as string] ?? "Select outcome"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OUTCOME_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="outcomeNotes">Outcome notes</Label>
            <Textarea id="outcomeNotes" name="outcomeNotes" rows={2} placeholder="What happened on site?" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerFeedback">Customer feedback</Label>
            <Textarea
              id="customerFeedback"
              name="customerFeedback"
              rows={2}
              placeholder="What did the customer say?"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recommendedAction">Recommended next action</Label>
            <Select name="recommendedAction">
              <SelectTrigger id="recommendedAction" className="w-full">
                <SelectValue placeholder="None">
                  {(value: unknown) => RECOMMENDED_ACTION_LABEL[value as string] ?? "None"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RECOMMENDED_ACTION_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recommendedActionNotes">Recommended action notes</Label>
            <Textarea
              id="recommendedActionNotes"
              name="recommendedActionNotes"
              rows={2}
              placeholder="Any detail for whoever acts on this"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="followUpDate">Follow-up date (optional)</Label>
            <Input
              id="followUpDate"
              name="followUpDate"
              type="date"
              defaultValue={toDateInputValue(followUpDate)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photos">Photos (optional)</Label>
            <Input id="photos" name="photos" type="file" accept="image/*" multiple />
            <p className="text-xs text-muted-foreground">Max 10MB each.</p>
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Mark completed"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
