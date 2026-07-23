"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateTaskStatus, deleteTask } from "@/lib/actions/me";
import { formatDate } from "@/lib/format";
import { ArrowRight, ArrowLeft, Trash2 } from "lucide-react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: Date | string | null;
};

const columns: { status: TaskStatus; title: string }[] = [
  { status: "TODO", title: "To Do" },
  { status: "IN_PROGRESS", title: "In Progress" },
  { status: "DONE", title: "Done" },
];

function TaskCard({ task }: { task: TaskItem }) {
  const [isPending, startTransition] = useTransition();

  function move(status: TaskStatus) {
    startTransition(async () => {
      try {
        await updateTaskStatus(task.id, status);
      } catch {
        toast.error("Could not update task");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await deleteTask(task.id);
      } catch {
        toast.error("Could not delete task");
      }
    });
  }

  return (
    <div className="rounded-lg border bg-card p-3 text-sm">
      <p className="font-medium">{task.title}</p>
      {task.description && (
        <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
      )}
      {task.dueDate && (
        <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(task.dueDate)}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {task.status !== "TODO" && (
            <Button
              size="icon-xs"
              variant="outline"
              disabled={isPending}
              onClick={() => move(task.status === "DONE" ? "IN_PROGRESS" : "TODO")}
              title="Move back"
            >
              <ArrowLeft className="size-3" />
            </Button>
          )}
          {task.status !== "DONE" && (
            <Button
              size="icon-xs"
              variant="outline"
              disabled={isPending}
              onClick={() => move(task.status === "TODO" ? "IN_PROGRESS" : "DONE")}
              title="Move forward"
            >
              <ArrowRight className="size-3" />
            </Button>
          )}
        </div>
        <Button
          size="icon-xs"
          variant="outline"
          disabled={isPending}
          onClick={remove}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

export function TaskBoard({ tasks }: { tasks: TaskItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {columns.map((col) => {
        const items = tasks.filter((t) => t.status === col.status);
        return (
          <Card key={col.status} className="py-4">
            <CardContent className="px-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">{col.title}</p>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nothing here.</p>
                )}
                {items.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
