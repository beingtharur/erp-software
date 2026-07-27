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
import { updateTicketStatus } from "@/lib/actions/crm";
import { TICKET_STATUS_TRANSITIONS, nextStatuses, type TicketStatus } from "@/lib/status-transitions";
import { cn } from "@/lib/utils";

const badgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "outline",
  IN_PROGRESS: "secondary",
  RESOLVED: "default",
  CLOSED: "secondary",
};

export function TicketStatusMenu({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: TicketStatus) {
    startTransition(async () => {
      try {
        await updateTicketStatus(ticketId, next);
        toast.success(`Ticket marked ${titleCase(next)}`);
      } catch {
        toast.error("Could not update ticket");
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
          {nextStatuses(TICKET_STATUS_TRANSITIONS, status as TicketStatus).map((s) => (
            <DropdownMenuItem key={s} onClick={() => handleChange(s)}>
              Mark {titleCase(s)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
