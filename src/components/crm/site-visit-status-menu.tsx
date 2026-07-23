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
import { updateSiteVisitStatus } from "@/lib/actions/crm";
import { cn } from "@/lib/utils";

const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

const badgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SCHEDULED: "secondary",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

export function SiteVisitStatusMenu({
  visitId,
  status,
}: {
  visitId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: (typeof STATUSES)[number]) {
    startTransition(async () => {
      try {
        await updateSiteVisitStatus(visitId, next);
        toast.success(`Visit marked ${titleCase(next)}`);
      } catch {
        toast.error("Could not update visit");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn("cursor-pointer", isPending && "opacity-60")} render={<button type="button" />}>
        <Badge variant={badgeVariant[status]} className="font-normal">
          {titleCase(status)}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {STATUSES.filter((s) => s !== status).map((s) => (
            <DropdownMenuItem key={s} onClick={() => handleChange(s)}>
              Mark {titleCase(s)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
