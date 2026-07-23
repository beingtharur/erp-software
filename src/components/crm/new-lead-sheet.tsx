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
import { createLead } from "@/lib/actions/crm";
import { Plus } from "lucide-react";

export function NewLeadSheet({
  clients,
  salesReps,
  isAdmin,
  currentEmployeeId,
}: {
  clients: { id: string; name: string }[];
  salesReps: { id: string; name: string }[];
  isAdmin: boolean;
  currentEmployeeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createLead, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Lead created");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus />
        New Lead
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New lead</SheetTitle>
          <SheetDescription>
            Add an RFQ, tender, or opportunity to the pipeline.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Opportunity title</Label>
            <Input id="title" name="title" placeholder="Client — deal description" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientId">Client</Label>
            <Select name="clientId" required>
              <SelectTrigger id="clientId" className="w-full">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source">Source</Label>
              <Select name="source" required defaultValue="RFQ">
                <SelectTrigger id="source" className="w-full">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RFQ">RFQ</SelectItem>
                  <SelectItem value="TENDER">Tender</SelectItem>
                  <SelectItem value="REFERRAL">Referral</SelectItem>
                  <SelectItem value="WEBSITE">Website</SelectItem>
                  <SelectItem value="EXHIBITION">Exhibition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="productLine">Product line</Label>
              <Select name="productLine" required defaultValue="PROCESS_EQUIPMENT">
                <SelectTrigger id="productLine" className="w-full">
                  <SelectValue placeholder="Product line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROCESS_EQUIPMENT">Process Equipment</SelectItem>
                  <SelectItem value="CONTAINMENT_SYSTEMS">Containment Systems</SelectItem>
                  <SelectItem value="PIPING_DISTRIBUTION">Piping Distribution</SelectItem>
                  <SelectItem value="TURNKEY_PROJECTS">Turnkey Projects</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="value">Deal value (₹)</Label>
              <Input id="value" name="value" type="number" min={0} step={1000} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="probability">Probability (%)</Label>
              <Input
                id="probability"
                name="probability"
                type="number"
                min={0}
                max={100}
                defaultValue={20}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expectedCloseDate">Expected close date</Label>
            <Input id="expectedCloseDate" name="expectedCloseDate" type="date" required />
          </div>

          {isAdmin ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ownerId">Owner</Label>
              <Select name="ownerId" required defaultValue={currentEmployeeId ?? undefined}>
                <SelectTrigger id="ownerId" className="w-full">
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {salesReps.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <input type="hidden" name="ownerId" value={currentEmployeeId ?? ""} />
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Optional context…" rows={3} />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create lead"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
