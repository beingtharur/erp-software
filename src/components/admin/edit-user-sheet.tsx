"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUser } from "@/lib/actions/admin";
import { roleLabel, navSections } from "@/lib/nav";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil } from "lucide-react";
import type { AccessRole } from "@/generated/prisma/client";

export function EditUserSheet({
  user,
}: {
  user: {
    id: string;
    email: string;
    accessRole: AccessRole;
    employeeName: string | null;
    modules: string[];
  };
}) {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState<string[]>(user.modules);
  const [state, formAction, pending] = useActionState(updateUser, undefined);

  function toggleModule(key: string, checked: boolean) {
    setModules((prev) => (checked ? [...prev, key] : prev.filter((m) => m !== key)));
  }

  useEffect(() => {
    if (state?.success) {
      toast.success("User updated");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="icon-sm" variant="outline" />}>
        <Pencil className="size-3.5" />
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit user</SheetTitle>
          <SheetDescription>
            {user.employeeName ?? "Portal-only user"} · update login details or reset their password.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="userId" value={user.id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`email-${user.id}`}>Email</Label>
            <Input
              id={`email-${user.id}`}
              name="email"
              type="email"
              defaultValue={user.email}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`accessRole-${user.id}`}>Access role</Label>
            <Select name="accessRole" required defaultValue={user.accessRole}>
              <SelectTrigger id={`accessRole-${user.id}`} className="w-full">
                <SelectValue>
                  {(value: unknown) => roleLabel[value as keyof typeof roleLabel] ?? "Select role"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(roleLabel) as (keyof typeof roleLabel)[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabel[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Module access</Label>
            <p className="text-xs text-muted-foreground">
              Grants beyond the role&apos;s defaults are additive when switching roles from the
              table — uncheck a module here to actually revoke it.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              {navSections.map((section) => (
                <div key={section.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`module-${user.id}-${section.key}`}
                    checked={modules.includes(section.key)}
                    onCheckedChange={(checked) => toggleModule(section.key, checked === true)}
                  />
                  {modules.includes(section.key) && (
                    <input type="hidden" name="modules" value={section.key} />
                  )}
                  <Label htmlFor={`module-${user.id}-${section.key}`} className="font-normal">
                    {section.title}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`newPassword-${user.id}`}>Reset password (optional)</Label>
            <Input
              id={`newPassword-${user.id}`}
              name="newPassword"
              type="password"
              minLength={6}
              placeholder="Leave blank to keep current password"
            />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
