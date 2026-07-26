"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { titleCase } from "@/lib/format";
import { startVisit, cancelSiteVisit } from "@/lib/actions/crm";
import { RescheduleVisitSheet } from "@/components/crm/reschedule-visit-sheet";
import { CompleteVisitSheet } from "@/components/crm/complete-visit-sheet";
import { MoreHorizontal, Play } from "lucide-react";

const badgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SCHEDULED: "secondary",
  IN_PROGRESS: "secondary",
  RESCHEDULED: "outline",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

type VisitForActions = {
  id: string;
  status: string;
  followUpDate: Date | string | null;
};

export function SiteVisitActions({ visit }: { visit: VisitForActions }) {
  const [isPending, startTransition] = useTransition();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  function handleStart() {
    startTransition(async () => {
      try {
        await startVisit(visit.id);
        toast.success("Visit started");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not start visit");
      }
    });
  }

  function handleCancel() {
    if (!window.confirm("Cancel this site visit?")) return;
    startTransition(async () => {
      try {
        await cancelSiteVisit(visit.id);
        toast.success("Visit cancelled");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not cancel visit");
      }
    });
  }

  if (visit.status === "COMPLETED" || visit.status === "CANCELLED") {
    return (
      <Badge variant={badgeVariant[visit.status]} className="font-normal">
        {titleCase(visit.status)}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={badgeVariant[visit.status]} className="font-normal">
        {titleCase(visit.status)}
      </Badge>

      {visit.status === "IN_PROGRESS" ? (
        <Button size="xs" variant="outline" disabled={isPending} onClick={() => setCompleteOpen(true)}>
          Mark Completed
        </Button>
      ) : (
        <Button size="xs" variant="outline" disabled={isPending} onClick={handleStart}>
          <Play className="size-3" />
          Start Visit
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {visit.status !== "IN_PROGRESS" && (
            <DropdownMenuItem onClick={() => setRescheduleOpen(true)}>Reschedule</DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleCancel} className="text-destructive">
            Cancel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RescheduleVisitSheet visitId={visit.id} open={rescheduleOpen} onOpenChange={setRescheduleOpen} />
      <CompleteVisitSheet
        visitId={visit.id}
        followUpDate={visit.followUpDate}
        open={completeOpen}
        onOpenChange={setCompleteOpen}
      />
    </div>
  );
}
