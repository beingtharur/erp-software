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
import { createEmployee } from "@/lib/actions/hrms";
import { roleLabel } from "@/lib/nav";
import { Plus } from "lucide-react";

const EMPLOYEE_ROLE_LABEL: Record<string, string> = {
  INSTALLATION_CREW: "Installation Crew",
  TECHNICIAN: "Technician",
  SALES_REP: "Sales Rep",
  ENGINEER: "Engineer",
  PROJECT_MANAGER: "Project Manager",
  ADMIN: "Admin",
  HR: "HR",
  FINANCE: "Finance",
};

export function NewEmployeeSheet() {
  const [open, setOpen] = useState(false);
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
              <Label htmlFor="role">Role</Label>
              <Select name="role" required defaultValue="ENGINEER">
                <SelectTrigger id="role" className="w-full">
                  <SelectValue placeholder="Role">
                    {(value: unknown) => EMPLOYEE_ROLE_LABEL[value as string] ?? "Engineer"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSTALLATION_CREW">Installation Crew</SelectItem>
                  <SelectItem value="TECHNICIAN">Technician</SelectItem>
                  <SelectItem value="SALES_REP">Sales Rep</SelectItem>
                  <SelectItem value="ENGINEER">Engineer</SelectItem>
                  <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="FINANCE">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="department">Department</Label>
              <Input id="department" name="department" placeholder="e.g. Projects" required />
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
            <Label htmlFor="accessRole">Access role</Label>
            <Select name="accessRole" required>
              <SelectTrigger id="accessRole" className="w-full">
                <SelectValue placeholder="Select role">
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
