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
import { updateEmployee } from "@/lib/actions/hrms";
import { titleCase } from "@/lib/format";
import { Pencil } from "lucide-react";

const STATUS_OPTIONS = ["ACTIVE", "ON_LEAVE", "INACTIVE"] as const;

type ManagerOption = { id: string; name: string };

export function EditEmployeeSheet({
  employee,
  managerOptions,
}: {
  employee: {
    id: string;
    name: string;
    department: string;
    phone: string;
    baseLocation: string;
    status: string;
    reportingToId: string | null;
  };
  managerOptions: ManagerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateEmployee, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Employee updated");
      setOpen(false);
    }
  }, [state]);

  const managers = managerOptions.filter((m) => m.id !== employee.id);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="icon-sm" variant="outline" />}>
        <Pencil className="size-3.5" />
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit employee</SheetTitle>
          <SheetDescription>Update {employee.name}&apos;s profile.</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <input type="hidden" name="employeeId" value={employee.id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`name-${employee.id}`}>Full name</Label>
            <Input id={`name-${employee.id}`} name="name" defaultValue={employee.name} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`department-${employee.id}`}>Department</Label>
              <Input
                id={`department-${employee.id}`}
                name="department"
                defaultValue={employee.department}
                placeholder="e.g. Projects"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`phone-${employee.id}`}>Phone</Label>
              <Input
                id={`phone-${employee.id}`}
                name="phone"
                defaultValue={employee.phone}
                placeholder="+91 90000 00000"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`baseLocation-${employee.id}`}>Base location</Label>
            <Input
              id={`baseLocation-${employee.id}`}
              name="baseLocation"
              defaultValue={employee.baseLocation}
              placeholder="e.g. Vadodara, GJ"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`status-${employee.id}`}>Status</Label>
            <Select name="status" required defaultValue={employee.status}>
              <SelectTrigger id={`status-${employee.id}`} className="w-full">
                <SelectValue>{(value: unknown) => titleCase(String(value))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {titleCase(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`reportingToId-${employee.id}`}>Reports to</Label>
            <Select name="reportingToId" defaultValue={employee.reportingToId ?? "none"}>
              <SelectTrigger id={`reportingToId-${employee.id}`} className="w-full">
                <SelectValue>
                  {(value: unknown) =>
                    !value || value === "none"
                      ? "No manager"
                      : (managers.find((m) => m.id === value)?.name ?? "No manager")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Drives the org chart and who can assign this employee tasks from the Team Tasks board.
            </p>
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
