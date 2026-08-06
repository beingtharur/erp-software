"use client";

import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DepartmentOption = { id: string; name: string; code: string };

/**
 * The one department picker, shared by every form that assigns one (employee
 * create/edit, portal-access onboarding, self-service profile, budgets). It
 * only ever offers *active* departments — inactive ones keep their existing
 * members but stop taking new ones.
 *
 * Optional by default because an organization's first employees can exist
 * before anyone has set up the department structure; pass `required` where a
 * department genuinely has to be chosen (a budget must belong to one).
 */
export function DepartmentSelect({
  id,
  name = "departmentId",
  departments,
  defaultValue,
  required,
  allowNone = true,
}: {
  id: string;
  name?: string;
  departments: DepartmentOption[];
  defaultValue?: string | null;
  required?: boolean;
  allowNone?: boolean;
}) {
  const empty = departments.length === 0;

  return (
    <>
      <Select name={name} required={required} defaultValue={defaultValue ?? (allowNone ? "none" : undefined)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select department">
            {(value: unknown) => {
              if (!value || value === "none") return allowNone ? "No department" : "Select department";
              return departments.find((d) => d.id === value)?.name ?? "Select department";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {empty ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No departments found.</p>
          ) : (
            <>
              {allowNone && <SelectItem value="none">No department</SelectItem>}
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
      {empty && (
        <p className="text-xs text-muted-foreground">
          No departments yet —{" "}
          <Link href="/hrms/departments" className="font-medium underline">
            set one up
          </Link>{" "}
          to organize your team.
        </p>
      )}
    </>
  );
}
