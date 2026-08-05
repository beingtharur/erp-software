"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { addTaskComment, setTaskBlocked } from "@/lib/actions/me";
import { formatDateTime } from "@/lib/format";
import { MessageSquare } from "lucide-react";

type Comment = {
  id: string;
  body: string;
  createdAt: Date | string;
  author: { id: string; name: string };
};

export type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "TODO" | "IN_PROGRESS" | "DONE";
  isBlocked: boolean;
  blockerNote: string | null;
  dueDate: Date | string | null;
  comments: Comment[];
  employee?: { id: string; name: string } | null;
  assignedBy?: { id: string; name: string } | null;
};

export function TaskDetailSheet({
  task,
  viewerRole,
}: {
  task: TaskDetail;
  viewerRole: "assignee" | "assigner";
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [blockerNote, setBlockerNote] = useState(task.blockerNote ?? "");
  const [isPending, startTransition] = useTransition();

  function submitComment() {
    if (!comment.trim()) return;
    startTransition(async () => {
      try {
        await addTaskComment(task.id, comment);
        setComment("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not post comment");
      }
    });
  }

  function toggleBlocked(next: boolean) {
    startTransition(async () => {
      try {
        await setTaskBlocked(task.id, next, blockerNote);
        toast.success(next ? "Marked as blocked" : "Blocker cleared");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update task");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="icon-xs" variant="outline" title="View details">
            <MessageSquare className="size-3" />
          </Button>
        }
      />
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{task.title}</SheetTitle>
          <SheetDescription>
            {viewerRole === "assigner" && task.employee
              ? `Assigned to ${task.employee.name}`
              : task.assignedBy
                ? `Assigned by ${task.assignedBy.name}`
                : "Personal task"}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="font-normal">
              {task.priority === "HIGH" ? "High" : task.priority === "LOW" ? "Low" : "Medium"} priority
            </Badge>
            {task.isBlocked && (
              <Badge variant="destructive" className="font-normal">
                Blocked
              </Badge>
            )}
          </div>

          {task.isBlocked && task.blockerNote && viewerRole === "assigner" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
              {task.blockerNote}
            </div>
          )}

          {viewerRole === "assignee" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Blocker</label>
              {task.isBlocked ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm">{task.blockerNote}</p>
                  <Button size="sm" variant="outline" disabled={isPending} onClick={() => toggleBlocked(false)}>
                    Clear blocker
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Textarea
                    placeholder="What's blocking this task?"
                    rows={2}
                    value={blockerNote}
                    onChange={(e) => setBlockerNote(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending || !blockerNote.trim()}
                    onClick={() => toggleBlocked(true)}
                  >
                    Report blocker
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Activity</p>
            <div className="flex flex-col gap-2">
              {task.comments.length === 0 && (
                <p className="text-xs text-muted-foreground">No comments yet.</p>
              )}
              {task.comments.map((c) => (
                <div key={c.id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.author.name}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{c.body}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Textarea
                placeholder="Add a comment…"
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button size="sm" disabled={isPending || !comment.trim()} onClick={submitComment}>
                Post comment
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
