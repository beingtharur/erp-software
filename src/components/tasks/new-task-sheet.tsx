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
import { createTask } from "@/lib/actions/me";
import { Plus } from "lucide-react";

type AssignableEmployee = { id: string; name: string };

const PRIORITY_LABEL: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

export function NewTaskSheet({
  currentEmployeeId,
  assignableEmployees = [],
  isManager = false,
}: {
  currentEmployeeId?: string;
  assignableEmployees?: AssignableEmployee[];
  isManager?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTask, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Task added");
      setOpen(false);
    }
  }, [state]);

  const others = assignableEmployees.filter((e) => e.id !== currentEmployeeId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus />
        New Task
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New task</SheetTitle>
          <SheetDescription>
            {isManager ? "Add a task to your board, or assign one to your team." : "Add something to your personal board."}
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="e.g. Follow up with vendor" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Notes</Label>
            <Textarea id="description" name="description" placeholder="Optional details" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" defaultValue="MEDIUM">
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue>{(value: unknown) => PRIORITY_LABEL[value as string] ?? "Medium"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
          </div>

          {isManager && others.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assigneeId">Assign to</Label>
              <Select name="assigneeId" defaultValue={currentEmployeeId}>
                <SelectTrigger id="assigneeId" className="w-full">
                  <SelectValue>
                    {(value: unknown) =>
                      value === currentEmployeeId || !value
                        ? "Myself"
                        : (others.find((e) => e.id === value)?.name ?? "Myself")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {currentEmployeeId && <SelectItem value={currentEmployeeId}>Myself</SelectItem>}
                  {others.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
