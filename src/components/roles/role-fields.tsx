"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roleLabel } from "@/lib/nav";
import {
  accessRoleModuleTitles,
  employeeRoleLabel,
  employeeRoleOptions,
  suggestedAccessRole,
} from "@/lib/roles";
import type { AccessRole, EmployeeRole } from "@/generated/prisma/client";

/**
 * Job title picker (Employee.role). Shared by the new-employee, new-user and
 * complete-profile forms so the eight options and their labels can't drift
 * apart again. Works controlled (`value` + `onValueChange`, needed when a
 * PortalAccessSelect on the same form should follow the choice) or
 * uncontrolled (`defaultValue`).
 */
export function JobTitleSelect({
  id,
  name = "role",
  value,
  defaultValue,
  onValueChange,
  required,
}: {
  id: string;
  name?: string;
  value?: EmployeeRole;
  defaultValue?: EmployeeRole;
  onValueChange?: (value: EmployeeRole) => void;
  required?: boolean;
}) {
  return (
    <Select
      name={name}
      required={required}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next as EmployeeRole)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Select job title">
          {(current: unknown) =>
            employeeRoleLabel[current as EmployeeRole] ?? "Select job title"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {employeeRoleOptions.map((role) => (
          <SelectItem key={role} value={role}>
            {employeeRoleLabel[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Portal access level picker (User.accessRole), with a helper line naming the
 * modules the current level unlocks. When `suggestedFor` is given it pre-fills
 * the level suggested for that job title — but only until the admin picks a
 * level themselves, after which their choice is never overwritten.
 */
export function PortalAccessSelect({
  id,
  name = "accessRole",
  defaultValue = null,
  suggestedFor,
  required,
}: {
  id: string;
  name?: string;
  defaultValue?: AccessRole | null;
  suggestedFor?: EmployeeRole;
  required?: boolean;
}) {
  // Derived rather than synced in an effect: an explicit pick always wins, and
  // until one is made the field simply follows the current job title's
  // suggestion — so re-picking the job title re-suggests, but never silently
  // overwrites a level the admin chose on purpose.
  const [pickedValue, setPickedValue] = useState<AccessRole | null>(null);
  const suggestion = suggestedFor ? (suggestedAccessRole[suggestedFor] ?? null) : null;
  const value = pickedValue ?? suggestion ?? defaultValue;
  const pickedManually = pickedValue !== null;

  const modules = value ? accessRoleModuleTitles(value) : [];

  return (
    <>
      <Select
        name={name}
        required={required}
        value={value}
        onValueChange={(next) => setPickedValue(next as AccessRole | null)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select access level">
            {(current: unknown) => roleLabel[current as AccessRole] ?? "Select access level"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(roleLabel) as AccessRole[]).map((role) => (
            <SelectItem key={role} value={role}>
              {roleLabel[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {modules.length > 0
          ? `Opens ${modules.join(", ")} by default.`
          : "Controls which modules this person can open."}
        {suggestedFor && !pickedManually && suggestion
          ? ` Suggested for ${employeeRoleLabel[suggestedFor]} — change it if they need something else.`
          : null}
        {suggestedFor && !suggestion
          ? ` No default for ${employeeRoleLabel[suggestedFor]} — pick the modules they actually need.`
          : null}
      </p>
    </>
  );
}
