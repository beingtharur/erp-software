"use client";

import { useActionState, useEffect, useState } from "react";
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
import { createProjectTask } from "@/lib/actions/crm";
import { Plus } from "lucide-react";

type Option = { id: string; name: string };

export function NewProjectTaskSheet({
  projectId,
  milestones,
  employees,
  milestoneId,
}: {
  projectId: string;
  milestones: Option[];
  employees: Option[];
  milestoneId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createProjectTask, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Task added");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="xs" variant="outline" />}>
        <Plus />
        Task
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New task</SheetTitle>
          <SheetDescription>Add a task to this project.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="projectId" value={projectId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="e.g. Order stainless steel sheets" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="milestoneId">Milestone</Label>
            <Select name="milestoneId" defaultValue={milestoneId}>
              <SelectTrigger id="milestoneId" className="w-full">
                <SelectValue placeholder="Unassigned to a milestone">
                  {(value: unknown) =>
                    milestones.find((m) => m.id === value)?.name ?? "Unassigned to a milestone"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {milestones.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assigneeId">Assignee</Label>
              <Select name="assigneeId">
                <SelectTrigger id="assigneeId" className="w-full">
                  <SelectValue placeholder="Unassigned">
                    {(value: unknown) => employees.find((e) => e.id === value)?.name ?? "Unassigned"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add task"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
