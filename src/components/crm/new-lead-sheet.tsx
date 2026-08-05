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
import { NewClientSheet } from "@/components/crm/new-client-sheet";
import { createLead } from "@/lib/actions/crm";
import { Plus } from "lucide-react";

const SOURCE_LABEL: Record<string, string> = {
  RFQ: "RFQ",
  TENDER: "Tender",
  REFERRAL: "Referral",
  WEBSITE: "Website",
  EXHIBITION: "Exhibition",
};

const PRODUCT_LINE_LABEL: Record<string, string> = {
  PROCESS_EQUIPMENT: "Process Equipment",
  CONTAINMENT_SYSTEMS: "Containment Systems",
  PIPING_DISTRIBUTION: "Piping Distribution",
  TURNKEY_PROJECTS: "Turnkey Projects",
};

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
  const [clientId, setClientId] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(createLead, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Lead created");
      setClientId(null);
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
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="clientId">Client</Label>
              {/* Quick create: a lead can't be filed without a client, and
                  bouncing to the Clients tab would throw away everything typed
                  here. Reuses the same sheet (and the same createClient action)
                  the Clients tab uses; createClient revalidates /crm, so the
                  refreshed list arrives with the new client already selected. */}
              <NewClientSheet
                trigger={
                  <Button type="button" size="xs" variant="ghost" className="-my-1">
                    <Plus />
                    New client
                  </Button>
                }
                onCreated={setClientId}
              />
            </div>
            <Select
              name="clientId"
              required
              value={clientId}
              onValueChange={(value) => setClientId(value as string)}
            >
              <SelectTrigger id="clientId" className="w-full">
                <SelectValue placeholder="Select client">
                  {(value: unknown) => clients.find((c) => c.id === value)?.name ?? "Select client"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clients.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">No clients found.</p>
                ) : (
                  clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {clients.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No clients yet — use <span className="font-medium">New client</span> above to add
                one without leaving this form.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source">Source</Label>
              <Select name="source" required defaultValue="RFQ">
                <SelectTrigger id="source" className="w-full">
                  <SelectValue placeholder="Source">
                    {(value: unknown) => SOURCE_LABEL[value as string] ?? "RFQ"}
                  </SelectValue>
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
                  <SelectValue placeholder="Product line">
                    {(value: unknown) => PRODUCT_LINE_LABEL[value as string] ?? "Process Equipment"}
                  </SelectValue>
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
              <Select
                name="ownerId"
                required
                disabled={salesReps.length === 0}
                defaultValue={currentEmployeeId ?? undefined}
              >
                <SelectTrigger id="ownerId" className="w-full">
                  <SelectValue placeholder="Select owner">
                    {(value: unknown) => salesReps.find((s) => s.id === value)?.name ?? "Select owner"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {salesReps.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">No employees found.</p>
                  ) : (
                    salesReps.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {salesReps.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No employees yet — add one under HRMS → Employees first.
                </p>
              )}
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
