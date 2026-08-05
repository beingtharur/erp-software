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
import { updateTask } from "@/lib/actions/tasks";
import { Pencil } from "lucide-react";

type AssignableEmployee = { id: string; name: string };

const PRIORITY_LABEL: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

function toDateInputValue(date: Date | string | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * Edit and reassign, for whoever may manage the task (its assigner, or
 * ADMIN/HR). Same fields as the create sheet — the difference is that the
 * assignee here is an existing value that can be moved to someone else, which
 * re-notifies the new assignee.
 */
export function EditTaskSheet({
  task,
  employees,
}: {
  task: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    dueDate: Date | string | null;
    employee: { id: string; name: string };
  };
  employees: AssignableEmployee[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateTask, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Task updated");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="icon-xs" variant="outline" title="Edit task" />}>
        <Pencil className="size-3" />
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit task</SheetTitle>
          <SheetDescription>
            Currently assigned to {task.employee.name}. Moving it to someone else notifies them.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="taskId" value={task.id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`title-${task.id}`}>Title</Label>
            <Input id={`title-${task.id}`} name="title" defaultValue={task.title} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`description-${task.id}`}>Notes</Label>
            <Textarea
              id={`description-${task.id}`}
              name="description"
              rows={3}
              defaultValue={task.description ?? ""}
              placeholder="Optional details"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`priority-${task.id}`}>Priority</Label>
              <Select name="priority" defaultValue={task.priority}>
                <SelectTrigger id={`priority-${task.id}`} className="w-full">
                  <SelectValue>
                    {(value: unknown) => PRIORITY_LABEL[value as string] ?? "Medium"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`dueDate-${task.id}`}>Due date</Label>
              <Input
                id={`dueDate-${task.id}`}
                name="dueDate"
                type="date"
                defaultValue={toDateInputValue(task.dueDate)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`assigneeId-${task.id}`}>Assigned to</Label>
            <Select name="assigneeId" defaultValue={task.employee.id}>
              <SelectTrigger id={`assigneeId-${task.id}`} className="w-full">
                <SelectValue>
                  {(value: unknown) =>
                    employees.find((e) => e.id === value)?.name ?? task.employee.name
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employees.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">No employees found.</p>
                ) : (
                  employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
