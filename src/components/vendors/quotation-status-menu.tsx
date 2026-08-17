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
import { updateProcurementQuotationStatus } from "@/lib/actions/procurement-quotations";
import {
  PROCUREMENT_QUOTATION_STATUS_TRANSITIONS,
  nextStatuses,
  type ProcurementQuotationStatus,
} from "@/lib/status-transitions";
import { cn } from "@/lib/utils";

const badgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  RECEIVED: "outline",
  UNDER_REVIEW: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  EXPIRED: "outline",
};

export function QuotationStatusMenu({ quotationId, status }: { quotationId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: ProcurementQuotationStatus) {
    startTransition(async () => {
      try {
        await updateProcurementQuotationStatus(quotationId, next);
        toast.success(`Quotation marked ${titleCase(next)}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update quotation");
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
          {nextStatuses(PROCUREMENT_QUOTATION_STATUS_TRANSITIONS, status as ProcurementQuotationStatus).map(
            (s) => (
              <DropdownMenuItem key={s} onClick={() => handleChange(s)}>
                Mark {titleCase(s)}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
