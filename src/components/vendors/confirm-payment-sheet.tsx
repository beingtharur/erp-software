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
import { requestPaymentConfirmation } from "@/lib/actions/vendor";

export function ConfirmPaymentSheet({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(requestPaymentConfirmation, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Submitted for confirmation — another admin needs to review it.");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" variant="outline" />}>Confirm payment</SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Confirm payment</SheetTitle>
          <SheetDescription>
            Record the reference for the transfer you made. A different admin will need to review
            and confirm it before it&apos;s marked Paid.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="paymentId" value={paymentId} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`referenceNumber-${paymentId}`}>Reference / UTR number</Label>
            <Input
              id={`referenceNumber-${paymentId}`}
              name="referenceNumber"
              placeholder="e.g. NEFT reference number"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`proof-${paymentId}`}>Proof of payment (optional)</Label>
            <Input id={`proof-${paymentId}`} name="proof" type="file" accept="image/*,.pdf" />
            <p className="text-xs text-muted-foreground">Bank confirmation or screenshot. Max 10MB.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`notes-${paymentId}`}>Notes (optional)</Label>
            <Textarea id={`notes-${paymentId}`} name="notes" rows={2} placeholder="Anything the reviewer should know" />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit for confirmation"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
