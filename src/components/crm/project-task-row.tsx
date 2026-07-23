"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { updateProjectTaskStatus } from "@/lib/actions/crm";
import { formatDate, initials } from "@/lib/format";
import { Check, RotateCcw } from "lucide-react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export function ProjectTaskRow({
  task,
}: {
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    dueDate: Date | string | null;
    assignee: { name: string } | null;
  };
}) {
  const [isPending, startTransition] = useTransition();

  function setStatus(status: TaskStatus) {
    startTransition(async () => {
      try {
        await updateProjectTaskStatus(task.id, status);
      } catch {
        toast.error("Could not update task");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
      <div className="flex min-w-0 items-center gap-2.5">
        {task.assignee ? (
          <Avatar className="size-6 shrink-0">
            <AvatarFallback className="text-[9px]">{initials(task.assignee.name)}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="size-6 shrink-0 rounded-full border border-dashed" />
        )}
        <div className="min-w-0">
          <p className={"truncate" + (task.status === "DONE" ? " text-muted-foreground line-through" : "")}>
            {task.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {task.assignee?.name ?? "Unassigned"}
            {task.dueDate && <> · Due {formatDate(task.dueDate)}</>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {task.status !== "DONE" ? (
          <>
            {task.status === "TODO" ? (
              <Badge
                variant="outline"
                className="cursor-pointer font-normal"
                onClick={() => !isPending && setStatus("IN_PROGRESS")}
              >
                Start
              </Badge>
            ) : (
              <Badge variant="secondary" className="font-normal">
                In Progress
              </Badge>
            )}
            <Button
              size="icon-xs"
              variant="outline"
              disabled={isPending}
              onClick={() => setStatus("DONE")}
              title="Mark done"
              className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
            >
              <Check className="size-3" />
            </Button>
          </>
        ) : (
          <Button
            size="icon-xs"
            variant="outline"
            disabled={isPending}
            onClick={() => setStatus("TODO")}
            title="Reopen"
          >
            <RotateCcw className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
