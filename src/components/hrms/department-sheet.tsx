"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createDepartment, updateDepartment } from "@/lib/actions/departments";
import { ORG_UNIT_TYPE_LABEL, ORG_UNIT_TYPES } from "@/lib/departments";
import { Plus, Pencil } from "lucide-react";
import type { OrgUnitType } from "@/generated/prisma/client";

type EmployeeOption = { id: string; name: string };
type ParentOption = { id: string; name: string };

export type DepartmentRecord = {
  id: string;
  name: string;
  code: string;
  type: string;
  description: string | null;
  headId: string | null;
  parentId: string | null;
};

/**
 * One sheet for both create and edit — the fields are identical, and the only
 * difference is which action it posts to and whether a department id rides
 * along. Parent options exclude the department being edited, so the obvious
 * self-parent mistake isn't even offered (the action re-checks for deeper
 * cycles server-side).
 */
export function DepartmentSheet({
  department,
  employees,
  parentOptions,
}: {
  department?: DepartmentRecord;
  employees: EmployeeOption[];
  parentOptions: ParentOption[];
}) {
  const isEdit = Boolean(department);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateDepartment : createDepartment,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? "Department updated" : "Department created");
      setOpen(false);
    }
  }, [state, isEdit]);

  const parents = parentOptions.filter((p) => p.id !== department?.id);
  const fieldId = (name: string) => `${name}-${department?.id ?? "new"}`;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <SheetTrigger render={<Button size="icon-sm" variant="outline" title="Edit department" />}>
          <Pencil className="size-3.5" />
        </SheetTrigger>
      ) : (
        <SheetTrigger render={<Button size="sm" />}>
          <Plus />
          New Department
        </SheetTrigger>
      )}
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit department" : "New department"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? `Update ${department!.name}.`
              : "Departments organize your team and give budgets something to belong to."}
          </SheetDescription>
        </SheetHeader>
        {/* Keyed so the uncontrolled fields remount on open and after a save,
            instead of having their defaultValue mutated underneath them (which
            Base UI warns about, and which would otherwise leave the previous
            values in the form the next time it opens). */}
        <form
          key={`${open}-${department?.parentId ?? ""}-${department?.headId ?? ""}`}
          action={formAction}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          {isEdit && <input type="hidden" name="departmentId" value={department!.id} />}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fieldId("name")}>Name</Label>
              <Input
                id={fieldId("name")}
                name="name"
                defaultValue={department?.name}
                placeholder="e.g. Process Engineering"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fieldId("code")}>Code</Label>
              <Input
                id={fieldId("code")}
                name="code"
                defaultValue={department?.code}
                placeholder="e.g. PROC"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId("type")}>Unit type</Label>
            <Select name="type" defaultValue={department?.type ?? "DEPARTMENT"}>
              <SelectTrigger id={fieldId("type")} className="w-full">
                <SelectValue>
                  {(value: unknown) => ORG_UNIT_TYPE_LABEL[value as OrgUnitType] ?? "Department"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ORG_UNIT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ORG_UNIT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              What this unit represents. Nest units under each other to build divisions, plants,
              sections and teams.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId("description")}>Description</Label>
            <Textarea
              id={fieldId("description")}
              name="description"
              rows={2}
              defaultValue={department?.description ?? ""}
              placeholder="Optional — what this department is responsible for"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId("headId")}>Department head</Label>
            <Select name="headId" defaultValue={department?.headId ?? "none"}>
              <SelectTrigger id={fieldId("headId")} className="w-full">
                <SelectValue>
                  {(value: unknown) =>
                    !value || value === "none"
                      ? "No head assigned"
                      : (employees.find((e) => e.id === value)?.name ?? "No head assigned")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No head assigned</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId("parentId")}>Parent department</Label>
            <Select name="parentId" defaultValue={department?.parentId ?? "none"}>
              <SelectTrigger id={fieldId("parentId")} className="w-full">
                <SelectValue>
                  {(value: unknown) =>
                    !value || value === "none"
                      ? "Top level"
                      : (parents.find((p) => p.id === value)?.name ?? "Top level")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Top level</SelectItem>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nesting a department under another is how sections and teams will be represented.
            </p>
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create department"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
