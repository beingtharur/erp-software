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
import { convertQuotationToProject } from "@/lib/actions/crm";
import { ArrowRight } from "lucide-react";

const PRODUCT_LINE_LABEL: Record<string, string> = {
  PROCESS_EQUIPMENT: "Process Equipment",
  CONTAINMENT_SYSTEMS: "Containment Systems",
  PIPING_DISTRIBUTION: "Piping Distribution",
  TURNKEY_PROJECTS: "Turnkey Projects",
};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function ConvertToProjectSheet({
  quotationId,
  suggestedName,
  suggestedProductLine,
  amount,
}: {
  quotationId: string;
  suggestedName: string;
  suggestedProductLine?: string;
  amount: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(convertQuotationToProject, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Project created");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <ArrowRight />
        Convert to Project
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Convert to project</SheetTitle>
          <SheetDescription>
            Review the details — a project needs a few things this quotation doesn&apos;t track.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="quotationId" value={quotationId} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" name="name" required defaultValue={suggestedName} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Optional context…" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="productLine">Product line</Label>
            <Select name="productLine" required defaultValue={suggestedProductLine}>
              <SelectTrigger id="productLine" className="w-full">
                <SelectValue placeholder="Select product line">
                  {(value: unknown) => PRODUCT_LINE_LABEL[value as string] ?? "Select product line"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRODUCT_LINE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Label htmlFor="targetEndDate">Target end date</Label>
              <Input id="targetEndDate" name="targetEndDate" type="date" required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="value">Project value (₹)</Label>
            <Input id="value" name="value" type="number" min={0} step="any" required defaultValue={amount} />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create project"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
