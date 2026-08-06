import type { OrgUnitType } from "@/generated/prisma/client";

/**
 * Labels for the org-unit levels. Client-safe (no prisma import), so the
 * filters, the create/edit sheet and the table all read the same list — the
 * same pattern as lib/roles.ts.
 *
 * Ordered broadest-first, which is also the order a company would set them up
 * in: a Business Unit contains Divisions, which contain Plants or Branches,
 * which contain Departments, which contain Sections and Teams. Nothing enforces
 * that order — a small company can use DEPARTMENT and TEAM alone — it is just
 * the sequence the picker offers.
 */
export const ORG_UNIT_TYPE_LABEL: Record<OrgUnitType, string> = {
  BUSINESS_UNIT: "Business Unit",
  DIVISION: "Division",
  BRANCH: "Branch",
  PLANT: "Plant",
  DEPARTMENT: "Department",
  SECTION: "Section",
  TEAM: "Team",
};

export const ORG_UNIT_TYPES = Object.keys(ORG_UNIT_TYPE_LABEL) as OrgUnitType[];

/** Safe for values coming from a URL query string, which are plain strings. */
export function orgUnitTypeName(type: string) {
  return ORG_UNIT_TYPE_LABEL[type as OrgUnitType] ?? type;
}
