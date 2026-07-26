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
import { logTimesheet } from "@/lib/actions/me";
import { Plus } from "lucide-react";

export function LogTimesheetSheet({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(logTimesheet, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Timesheet logged");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" variant="outline" />}>
        <Plus />
        Log timesheet
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Log timesheet</SheetTitle>
          <SheetDescription>Record hours worked against a project.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="projectId">Project</Label>
            <Select name="projectId">
              <SelectTrigger id="projectId" className="w-full">
                <SelectValue placeholder="Select project (optional)">
                  {(value: unknown) => projects.find((p) => p.id === value)?.name ?? "Select project (optional)"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hoursLogged">Hours</Label>
              <Input
                id="hoursLogged"
                name="hoursLogged"
                type="number"
                min={0.5}
                max={16}
                step={0.5}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="taskDescription">Task</Label>
            <Textarea
              id="taskDescription"
              name="taskDescription"
              placeholder="What did you work on?"
              rows={3}
              required
            />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Logging…" : "Log hours"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
