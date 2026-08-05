"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { titleCase } from "@/lib/format";
import { updateTaskStatus } from "@/lib/actions/tasks";
import { cn } from "@/lib/utils";

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];

const badgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  TODO: "outline",
  IN_PROGRESS: "secondary",
  DONE: "default",
};

/**
 * Table-row status control for the HRMS Tasks console. The /me board moves
 * tasks one step at a time with arrows; a manager scanning a list needs to jump
 * straight to a status, so this offers all of them — the same freedom the
 * underlying updateTaskStatus action has always allowed.
 */
export function TaskStatusMenu({ taskId, status }: { taskId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: TaskStatus) {
    startTransition(async () => {
      try {
        await updateTaskStatus(taskId, next);
        toast.success(`Task marked ${titleCase(next)}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update task");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("cursor-pointer", isPending && "opacity-60")}
        render={<button type="button" />}
      >
        <Badge variant={badgeVariant[status]} className="font-normal">
          {titleCase(status)}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {TASK_STATUSES.filter((s) => s !== status).map((s) => (
            <DropdownMenuItem key={s} onClick={() => handleChange(s)}>
              Mark {titleCase(s)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
