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
import { createAmcContract } from "@/lib/actions/crm";
import { Plus } from "lucide-react";

type ClientOption = { id: string; name: string };

const BILLING_FREQUENCY_LABEL: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-Yearly",
  ANNUALLY: "Annually",
};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export type AmcInitialValues = {
  clientId: string;
  clientName: string;
  projectId?: string;
  contractName?: string;
  value?: number;
};

// Two entry points: standalone (client picker, no project) from /crm/amc, and
// project-triggered (client+project locked) from a completed project's detail page.
export function NewAmcContractSheet({
  clients,
  initialValues,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  clients: ClientOption[];
  initialValues?: AmcInitialValues;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const onOpenChange = isControlled ? onOpenChangeProp! : setInternalOpen;
  const [state, formAction, pending] = useActionState(createAmcContract, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("AMC contract created");
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const lockedClient = initialValues
    ? { id: initialValues.clientId, name: initialValues.clientName }
    : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {!isControlled && (
        <SheetTrigger render={<Button size="sm" />}>
          <Plus />
          New AMC Contract
        </SheetTrigger>
      )}
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New AMC contract</SheetTitle>
          <SheetDescription>Set up an annual maintenance contract for a client.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {initialValues?.projectId && (
            <input type="hidden" name="projectId" value={initialValues.projectId} />
          )}

          {lockedClient ? (
            <div className="flex flex-col gap-1.5">
              <Label>Client</Label>
              <input type="hidden" name="clientId" value={lockedClient.id} />
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{lockedClient.name}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientId">Client</Label>
              <Select name="clientId" required>
                <SelectTrigger id="clientId" className="w-full">
                  <SelectValue placeholder="Select client">
                    {(value: unknown) => clients.find((c) => c.id === value)?.name ?? "Select client"}
                  </SelectValue>
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
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contractName">Contract name</Label>
            <Input
              id="contractName"
              name="contractName"
              placeholder="e.g. Annual Maintenance — Reactor Vessel Line"
              defaultValue={initialValues?.contractName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="equipmentCovered">Equipment covered</Label>
            <Textarea id="equipmentCovered" name="equipmentCovered" rows={2} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                required
                defaultValue={toDateInputValue(new Date())}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" name="endDate" type="date" required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="value">Contract value (₹)</Label>
            <Input
              id="value"
              name="value"
              type="number"
              min={0}
              step="any"
              required
              defaultValue={initialValues?.value}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coverage">Coverage (optional)</Label>
            <Textarea id="coverage" name="coverage" rows={2} placeholder="What's included in scope…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visitsIncluded">Visits included (optional)</Label>
              <Input id="visitsIncluded" name="visitsIncluded" type="number" min={0} step={1} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="responseTime">Response time (optional)</Label>
              <Input id="responseTime" name="responseTime" placeholder="e.g. 24 hours" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nextServiceDate">First service due (optional)</Label>
            <Input id="nextServiceDate" name="nextServiceDate" type="date" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="billingFrequency">Billing frequency (optional)</Label>
              <Select name="billingFrequency">
                <SelectTrigger id="billingFrequency" className="w-full">
                  <SelectValue placeholder="None">
                    {(value: unknown) => BILLING_FREQUENCY_LABEL[value as string] ?? "None"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BILLING_FREQUENCY_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="renewalReminderDays">Renewal reminder (days before)</Label>
              <Input id="renewalReminderDays" name="renewalReminderDays" type="number" min={0} step={1} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create AMC contract"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
