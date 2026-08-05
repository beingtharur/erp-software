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
import { createProject } from "@/lib/actions/crm";
import { titleCase } from "@/lib/format";
import { Plus } from "lucide-react";

// titleCase already renders every ProductLine exactly as the rest of the CRM
// shows it (the projects table and lead sheet included), so there's no separate
// label map to drift out of sync here.
const PRODUCT_LINES = [
  "PROCESS_EQUIPMENT",
  "CONTAINMENT_SYSTEMS",
  "PIPING_DISTRIBUTION",
  "TURNKEY_PROJECTS",
] as const;

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function NewProjectSheet({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createProject, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Project created");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus />
        New Project
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New project</SheetTitle>
          <SheetDescription>
            For work that didn&apos;t come through a quotation. Everything after this — milestones,
            tasks, AMC contracts — works the same either way.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientId">Client</Label>
            <Select name="clientId" required>
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
            <p className="text-xs text-muted-foreground">
              {clients.length === 0
                ? "No clients yet — add one on the Clients tab first."
                : "The project inherits this client's industry."}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" name="name" placeholder="e.g. Containment upgrade — Unit 3" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Optional context…" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="productLine">Product line</Label>
            <Select name="productLine" required defaultValue="PROCESS_EQUIPMENT">
              <SelectTrigger id="productLine" className="w-full">
                <SelectValue placeholder="Select product line">
                  {(value: unknown) =>
                    value ? titleCase(String(value)) : "Select product line"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_LINES.map((line) => (
                  <SelectItem key={line} value={line}>
                    {titleCase(line)}
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
            <Input id="value" name="value" type="number" min={0} step="any" required />
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
