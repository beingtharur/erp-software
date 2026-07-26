"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteVendor } from "@/lib/actions/vendor";
import { Trash2 } from "lucide-react";

export function DeleteVendorButton({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(`Delete vendor "${vendorName}"? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteVendor(vendorId);
        toast.success("Vendor deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete vendor");
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
