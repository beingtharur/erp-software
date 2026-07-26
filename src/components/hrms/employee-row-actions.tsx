"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteEmployee } from "@/lib/actions/hrms";
import { Trash2 } from "lucide-react";

export function DeleteEmployeeButton({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm(`Delete employee "${employeeName}"? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteEmployee(employeeId);
        toast.success("Employee deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete employee");
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
