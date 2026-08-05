"use client";

import { useActionState, useEffect, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createClient } from "@/lib/actions/crm";
import { Plus } from "lucide-react";

const INDUSTRY_LABEL: Record<string, string> = {
  PHARMACEUTICALS: "Pharmaceuticals",
  CHEMICALS: "Chemicals",
  COSMETICS: "Cosmetics",
  BIOTECH: "Biotech",
  FOOD_AND_BEVERAGE: "Food & Beverage",
};

export function NewClientSheet({
  trigger,
  onCreated,
}: {
  /** Replaces the default "New Client" button — used when this sheet is opened
   *  from inside another form (see the new-lead sheet's quick create). */
  trigger?: ReactElement;
  /** Fired with the new client's id once it exists, so the opener can select it. */
  onCreated?: (clientId: string) => void;
} = {}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createClient, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Client added");
      setOpen(false);
      if (state.clientId) onCreated?.(state.clientId);
    }
    // onCreated is intentionally not a dependency: callers pass an inline
    // closure, and re-running this on every parent render would re-fire the
    // callback (and the toast) for an already-handled result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger ? (
        <SheetTrigger render={trigger} />
      ) : (
        <SheetTrigger render={<Button size="sm" />}>
          <Plus />
          New Client
        </SheetTrigger>
      )}
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New client</SheetTitle>
          <SheetDescription>Add a customer company record.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Client name</Label>
            <Input id="name" name="name" placeholder="Company name" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Select name="industry" required defaultValue="CHEMICALS">
                <SelectTrigger id="industry" className="w-full">
                  <SelectValue>
                    {(value: unknown) => INDUSTRY_LABEL[value as string] ?? "Chemicals"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INDUSTRY_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tier">Tier</Label>
              <Input id="tier" name="tier" placeholder="e.g. Gold" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" placeholder="e.g. Vadodara" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" placeholder="e.g. Gujarat" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactName">Contact person</Label>
              <Input id="contactName" name="contactName" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactTitle">Contact title</Label>
              <Input id="contactTitle" name="contactTitle" placeholder="e.g. Plant Head" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactEmail">Contact email</Label>
              <Input id="contactEmail" name="contactEmail" type="email" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactPhone">Contact phone</Label>
              <Input id="contactPhone" name="contactPhone" required />
            </div>
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add client"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
