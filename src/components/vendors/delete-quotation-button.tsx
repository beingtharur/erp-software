"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteProcurementQuotation } from "@/lib/actions/procurement-quotations";
import { Trash2 } from "lucide-react";

export function DeleteQuotationButton({ groupId, quotationNumber }: { groupId: string; quotationNumber: string }) {
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(`Delete quotation "${quotationNumber}" and all its versions? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteProcurementQuotation(groupId);
        toast.success("Quotation deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete quotation");
      }
    });
  }

  return (
    <Button
      size="icon-sm"
      variant="outline"
      disabled={isPending}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={onDelete}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
