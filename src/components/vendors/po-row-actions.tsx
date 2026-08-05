"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deletePurchaseOrder, duplicatePurchaseOrder, cancelPurchaseOrder } from "@/lib/actions/vendor";
import { Trash2, Repeat, Ban } from "lucide-react";

export function DeletePoButton({ poId, poNumber }: { poId: string; poNumber: string }) {
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(`Delete purchase order ${poNumber}? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deletePurchaseOrder(poId);
        toast.success("Purchase order deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete purchase order");
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

export function CancelPoButton({ poId, poNumber }: { poId: string; poNumber: string }) {
  const [isPending, startTransition] = useTransition();

  function onCancel() {
    if (!window.confirm(`Cancel purchase order ${poNumber}? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await cancelPurchaseOrder(poId);
        toast.success("Purchase order cancelled");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not cancel purchase order");
      }
    });
  }

  return (
    <Button
      size="icon-sm"
      variant="outline"
      disabled={isPending}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={onCancel}
      title="Cancel"
    >
      <Ban className="size-3.5" />
    </Button>
  );
}

export function ReorderPoButton({ poId }: { poId: string }) {
  const [isPending, startTransition] = useTransition();

  function onReorder() {
    startTransition(async () => {
      try {
        await duplicatePurchaseOrder(poId);
        toast.success("New purchase order created from this one");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not reorder");
      }
    });
  }

  return (
    <Button size="icon-sm" variant="outline" disabled={isPending} onClick={onReorder} title="Reorder">
      <Repeat className="size-3.5" />
    </Button>
  );
}
