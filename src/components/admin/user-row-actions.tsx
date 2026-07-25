"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { updateUserRole, revokeUserAccess } from "@/lib/actions/admin";
import { roleLabel } from "@/lib/nav";
import { UserX } from "lucide-react";
import type { AccessRole } from "@/generated/prisma/client";

export function UserRoleSelect({ userId, accessRole }: { userId: string; accessRole: AccessRole }) {
  const [isPending, startTransition] = useTransition();

  function onChange(value: AccessRole | null) {
    if (!value) return;
    startTransition(async () => {
      try {
        await updateUserRole(userId, value);
        toast.success("Role updated");
      } catch {
        toast.error("Could not update role");
      }
    });
  }

  return (
    <Select value={accessRole} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger size="sm" className="w-40">
        <SelectValue>{(value: unknown) => roleLabel[value as AccessRole] ?? String(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(roleLabel) as AccessRole[]).map((role) => (
          <SelectItem key={role} value={role}>
            {roleLabel[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RevokeAccessButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  function revoke() {
    startTransition(async () => {
      try {
        await revokeUserAccess(userId);
        toast.success("Access revoked");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not revoke access");
      }
    });
  }

  return (
    <Button
      size="icon-sm"
      variant="outline"
      disabled={isPending}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={revoke}
    >
      <UserX className="size-3.5" />
    </Button>
  );
}
