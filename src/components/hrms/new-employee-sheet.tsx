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
import { JobTitleSelect, PortalAccessSelect } from "@/components/roles/role-fields";
import { DepartmentSelect, type DepartmentOption } from "@/components/departments/department-select";
import { createEmployee } from "@/lib/actions/hrms";
import { Plus } from "lucide-react";
import type { EmployeeRole } from "@/generated/prisma/client";

export function NewEmployeeSheet({ departments }: { departments: DepartmentOption[] }) {
  const [open, setOpen] = useState(false);
  const [jobTitle, setJobTitle] = useState<EmployeeRole>("ENGINEER");
  const [state, formAction, pending] = useActionState(createEmployee, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Employee added");
      setOpen(false);
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <Plus />
        New Employee
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New employee</SheetTitle>
          <SheetDescription>Onboard a new team member.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" placeholder="Employee name" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Job title</Label>
              <JobTitleSelect id="role" required value={jobTitle} onValueChange={setJobTitle} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="departmentId">Department</Label>
              <DepartmentSelect id="departmentId" departments={departments} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="name@eostechno.com" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="+91 90000 00000" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateOfJoining">Date of joining</Label>
              <Input id="dateOfJoining" name="dateOfJoining" type="date" required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="baseLocation">Base location</Label>
            <Input id="baseLocation" name="baseLocation" placeholder="e.g. Vadodara, GJ" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accessRole">Portal access level</Label>
            <PortalAccessSelect id="accessRole" required suggestedFor={jobTitle} />
            <p className="text-xs text-muted-foreground">
              A portal login is created automatically with temporary password{" "}
              <span className="font-mono">demo123</span>.
            </p>
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add employee"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
