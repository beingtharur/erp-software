"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reviseQuotation } from "@/lib/actions/crm";
import { RefreshCcw } from "lucide-react";

const REVISABLE = ["SENT", "UNDER_REVIEW", "REJECTED"] as const;

export function ReviseQuotationButton({
  quotationId,
  status,
}: {
  quotationId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (!(REVISABLE as readonly string[]).includes(status)) return null;

  function handleRevise() {
    startTransition(async () => {
      try {
        const updated = await reviseQuotation(quotationId);
        toast.success(`Bumped to revision ${updated.revision} — back in Draft.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not revise quotation");
      }
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={isPending} onClick={handleRevise}>
      <RefreshCcw className="size-3.5" />
      Revise
    </Button>
  );
}
