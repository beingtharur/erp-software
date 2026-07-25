"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitPayment } from "@/lib/actions/billing";

export function PaymentSubmissionForm({
  numUsers,
  modules,
}: {
  numUsers: number;
  modules: string[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitPayment, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Payment submitted — pending verification");
      router.push("/subscription");
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border p-6">
      <h2 className="text-sm font-semibold">Submit payment confirmation</h2>

      <input type="hidden" name="numUsers" value={numUsers} />
      {modules.map((m) => (
        <input key={m} type="hidden" name="modules" value={m} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="method">Payment method</Label>
          <Select name="method" required defaultValue="UPI">
            <SelectTrigger id="method" className="w-full">
              <SelectValue>
                {(value: unknown) => (value === "BANK_TRANSFER" ? "Bank transfer" : "UPI")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paymentDate">Payment date</Label>
          <Input id="paymentDate" name="paymentDate" type="date" required max={new Date().toISOString().slice(0, 10)} />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="utr">UTR / Transaction ID</Label>
          <Input id="utr" name="utr" required placeholder="e.g. 402812345678" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payerUpiId">Payer UPI ID (optional)</Label>
          <Input id="payerUpiId" name="payerUpiId" placeholder="you@upi" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="screenshot">Payment screenshot (optional)</Label>
          <Input id="screenshot" name="screenshot" type="file" accept="image/*" />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" name="notes" rows={2} />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit for verification"}
      </Button>
    </form>
  );
}
