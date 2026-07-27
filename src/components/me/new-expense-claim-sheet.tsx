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
import { createExpenseClaim } from "@/lib/actions/finance";
import { Plus } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  TRAVEL: "Travel",
  MEALS: "Meals",
  SUPPLIES: "Supplies",
  EQUIPMENT: "Equipment",
  SOFTWARE: "Software",
  OTHER: "Other",
};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function NewExpenseClaimSheet() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createExpenseClaim, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Expense claim submitted");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus />
        Submit claim
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Submit expense claim</SheetTitle>
          <SheetDescription>Send a reimbursement request for Finance approval.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Select name="category" required defaultValue="TRAVEL">
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Select category">
                    {(value: unknown) => CATEGORY_LABEL[value as string] ?? "Travel"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRAVEL">Travel</SelectItem>
                  <SelectItem value="MEALS">Meals</SelectItem>
                  <SelectItem value="SUPPLIES">Supplies</SelectItem>
                  <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                  <SelectItem value="SOFTWARE">Software</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input id="amount" name="amount" type="number" min="0" step="any" required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expenseDate">Expense date</Label>
            <Input
              id="expenseDate"
              name="expenseDate"
              type="date"
              max={toDateInputValue(new Date())}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What was this for?"
              rows={3}
              required
            />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit claim"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
