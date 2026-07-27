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
import { updateMilestoneStatus } from "@/lib/actions/crm";
import { MILESTONE_STATUS_TRANSITIONS, nextStatuses, type MilestoneStatus } from "@/lib/status-transitions";
import { cn } from "@/lib/utils";


const badgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PLANNED: "outline",
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
  DELAYED: "destructive",
};

export function MilestoneStatusMenu({
  milestoneId,
  status,
}: {
  milestoneId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: MilestoneStatus) {
    startTransition(async () => {
      try {
        await updateMilestoneStatus(milestoneId, next);
        toast.success(`Milestone marked ${titleCase(next)}`);
      } catch {
        toast.error("Could not update milestone");
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
          {nextStatuses(MILESTONE_STATUS_TRANSITIONS, status as MilestoneStatus).map((s) => (
            <DropdownMenuItem key={s} onClick={() => handleChange(s)}>
              Mark {titleCase(s)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
