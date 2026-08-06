"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setDepartmentActive } from "@/lib/actions/departments";
import { Power, PowerOff } from "lucide-react";

/**
 * Departments are deactivated, never deleted — employees and budgets reference
 * them, and that history is worth more than a tidy list.
 */
export function DepartmentStatusButton({
  departmentId,
  departmentName,
  isActive,
}: {
  departmentId: string;
  departmentName: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      try {
        await setDepartmentActive(departmentId, !isActive);
        toast.success(isActive ? `${departmentName} deactivated` : `${departmentName} reactivated`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update department");
      }
    });
  }

  return (
    <Button
      size="icon-sm"
      variant="outline"
      disabled={isPending}
      onClick={toggle}
      title={isActive ? "Deactivate" : "Reactivate"}
      className={isActive ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : ""}
    >
      {isActive ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
    </Button>
  );
}
