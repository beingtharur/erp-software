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
import { createUserForEmployee } from "@/lib/actions/admin";
import { roleLabel } from "@/lib/nav";
import { Plus } from "lucide-react";

type EligibleEmployee = {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
};

export function NewUserSheet({ employees }: { employees: EligibleEmployee[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUserForEmployee, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Portal access granted");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" disabled={employees.length === 0} />}>
        <Plus />
        New user
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Grant portal access</SheetTitle>
          <SheetDescription>
            Create a login for an existing employee who doesn&apos;t have one yet.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employeeId">Employee</Label>
            <Select name="employeeId" required>
              <SelectTrigger id="employeeId" className="w-full">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} · {emp.employeeCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Login email is the employee&apos;s existing email address.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accessRole">Access role</Label>
            <Select name="accessRole" required>
              <SelectTrigger id="accessRole" className="w-full">
                <SelectValue placeholder="Select role" />
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
            <Label htmlFor="password">Temporary password</Label>
            <Input id="password" name="password" type="password" minLength={6} required />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Grant access"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
