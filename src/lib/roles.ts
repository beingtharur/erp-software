import type { AccessRole, EmployeeRole } from "@/generated/prisma/client";
import { navSections, roleSectionAccess } from "@/lib/nav";

/**
 * The app carries two unrelated "role" concepts that the UI used to label
 * identically, which is genuinely confusing because several values collide by
 * name (Employee.role ADMIN/HR/FINANCE vs User.accessRole ADMIN/HR/FINANCE,
 * and Employee.role SALES_REP vs accessRole SALES whose label is "Sales Rep"):
 *
 *   - `Employee.role` (EmployeeRole) — the person's **job title**. Drives HR
 *     reporting, the Live Map's field-crew filter, and job-title broadcasts
 *     (see notifyEmployeeRole). Grants no permissions whatsoever.
 *   - `User.accessRole` (AccessRole) — their **portal access level**. Drives
 *     which nav sections and routes they can open (roleSectionAccess) and which
 *     approvals they may decide.
 *
 * Everything user-facing should say "job title" for the former and "portal
 * access level" for the latter. This module is the single source for both
 * labels; before it existed the EmployeeRole map was copy-pasted into four
 * components (one of which only listed three of the eight values).
 */
export const employeeRoleLabel: Record<EmployeeRole, string> = {
  INSTALLATION_CREW: "Installation Crew",
  TECHNICIAN: "Technician",
  SALES_REP: "Sales Rep",
  ENGINEER: "Engineer",
  PROJECT_MANAGER: "Project Manager",
  ADMIN: "Admin",
  HR: "HR",
  FINANCE: "Finance",
};

export const employeeRoleOptions = Object.keys(employeeRoleLabel) as EmployeeRole[];

export function employeeRoleName(role: string) {
  return employeeRoleLabel[role as EmployeeRole] ?? role;
}

/**
 * Suggested portal access level for a job title — a *default*, never a rule:
 * the selects that use it stop suggesting the moment the admin picks something
 * themselves, and nothing server-side derives permissions from job title.
 *
 * Deliberately partial. ENGINEER and PROJECT_MANAGER are cross-functional here
 * (site work plus project delivery, which live in two different modules), so
 * there is no single least-privilege answer to default them to — the admin is
 * asked to choose rather than being nudged into over- or under-granting.
 */
export const suggestedAccessRole: Partial<Record<EmployeeRole, AccessRole>> = {
  INSTALLATION_CREW: "FIELD",
  TECHNICIAN: "FIELD",
  SALES_REP: "SALES",
  ADMIN: "ADMIN",
  HR: "HR",
  FINANCE: "FINANCE",
};

/** Nav section titles an access level unlocks, for "Unlocks CRM, HRMS…" hints. */
export function accessRoleModuleTitles(role: AccessRole) {
  return roleSectionAccess[role]
    .map((key) => navSections.find((section) => section.key === key)?.title)
    .filter((title): title is string => Boolean(title));
}
