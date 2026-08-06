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
import { JobTitleSelect, PortalAccessSelect } from "@/components/roles/role-fields";
import { DepartmentSelect, type DepartmentOption } from "@/components/departments/department-select";
import { createUserForEmployee } from "@/lib/actions/admin";
import { Plus } from "lucide-react";
import type { EmployeeRole } from "@/generated/prisma/client";

type EligibleEmployee = {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
  role: EmployeeRole;
};

export function NewUserSheet({
  employees,
  departments,
}: {
  employees: EligibleEmployee[];
  departments: DepartmentOption[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">(employees.length > 0 ? "existing" : "new");
  const [newJobTitle, setNewJobTitle] = useState<EmployeeRole>("ENGINEER");
  const [existingEmployeeId, setExistingEmployeeId] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(createUserForEmployee, undefined);

  // The access-level suggestion follows whichever job title the form is
  // actually about: the one being typed in "new person" mode, or the already
  // stored job title of the employee picked in "existing employee" mode.
  const suggestedFor =
    mode === "new"
      ? newJobTitle
      : employees.find((e) => e.id === existingEmployeeId)?.role;

  useEffect(() => {
    if (state?.success) {
      toast.success("Portal access granted");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus />
        New user
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Grant portal access</SheetTitle>
          <SheetDescription>
            Give an existing employee a login, or add a brand-new person and grant them access in
            one step.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="mode" value={mode} />

          <div className="flex gap-1.5 rounded-lg border p-1">
            <Button
              type="button"
              size="sm"
              variant={mode === "existing" ? "secondary" : "ghost"}
              className="flex-1"
              disabled={employees.length === 0}
              onClick={() => setMode("existing")}
            >
              Existing employee
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "new" ? "secondary" : "ghost"}
              className="flex-1"
              onClick={() => setMode("new")}
            >
              New person
            </Button>
          </div>

          {mode === "existing" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employeeId">Employee</Label>
              <Select
                name="employeeId"
                required={mode === "existing"}
                value={existingEmployeeId}
                onValueChange={(value) => setExistingEmployeeId(value as string | null)}
              >
                <SelectTrigger id="employeeId" className="w-full">
                  <SelectValue placeholder="Select employee">
                    {(value: unknown) => {
                      const emp = employees.find((e) => e.id === value);
                      return emp ? `${emp.name} · ${emp.employeeCode}` : "Select employee";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      Every employee already has portal access.
                    </p>
                  ) : (
                    employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} · {emp.employeeCode}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Login email is the employee&apos;s existing email address.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" name="name" placeholder="Person's name" required={mode === "new"} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="role">Job title</Label>
                  <JobTitleSelect
                    id="role"
                    required={mode === "new"}
                    value={newJobTitle}
                    onValueChange={setNewJobTitle}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="departmentId">Department</Label>
                  <DepartmentSelect id="departmentId" departments={departments} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="name@eostechno.com" required={mode === "new"} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" placeholder="+91 90000 00000" required={mode === "new"} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dateOfJoining">Date of joining</Label>
                  <Input id="dateOfJoining" name="dateOfJoining" type="date" required={mode === "new"} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="baseLocation">Base location</Label>
                <Input id="baseLocation" name="baseLocation" placeholder="e.g. Vadodara, GJ" required={mode === "new"} />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accessRole">Portal access level</Label>
            <PortalAccessSelect id="accessRole" required suggestedFor={suggestedFor} />
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
