import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Departments are organization master data. Every read here is scoped by
// organizationId — Department carries the column directly rather than
// inheriting it through a relation, because it *is* a root organizational
// entity, the same way Employee and Client are.

export type DepartmentFilters = {
  search?: string;
  /** "active" | "inactive" — anything else means both. */
  status?: string;
  /** An OrgUnitType, or "ALL". */
  type?: string;
};

export async function getDepartments(organizationId: string, filters: DepartmentFilters = {}) {
  const where: Prisma.DepartmentWhereInput = { organizationId };

  if (filters.status === "active") where.isActive = true;
  else if (filters.status === "inactive") where.isActive = false;

  if (filters.type && filters.type !== "ALL") {
    where.type = filters.type as Prisma.DepartmentWhereInput["type"];
  }

  const search = filters.search?.trim();
  if (search) {
    // SQLite has no case-insensitive `mode` in Prisma — substring match on the
    // stored casing, consistent with every other search in the app.
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
      { description: { contains: search } },
    ];
  }

  return prisma.department.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      head: { select: { id: true, name: true } },
      parent: { select: { id: true, name: true } },
      _count: { select: { employees: true, children: true } },
    },
  });
}

/**
 * Active departments only, for the pickers on employee forms — an inactive
 * department shouldn't collect new people, though existing members keep their
 * link so history stays readable.
 */
export async function getDepartmentOptions(organizationId: string) {
  return prisma.department.findMany({
    where: { organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
}

/** Headcount per department for the HRMS overview, active employees only. */
export async function getDepartmentHeadcount(organizationId: string) {
  const departments = await prisma.department.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      _count: {
        select: { employees: { where: { status: "ACTIVE", deletedAt: null } } },
      },
    },
  });

  // Employees who predate the department module (or whose department was
  // removed) still need to be visible in a headcount, or the numbers quietly
  // stop adding up to the active headcount KPI next to them.
  const unassigned = await prisma.employee.count({
    where: { organizationId, status: "ACTIVE", deletedAt: null, departmentId: null },
  });

  return {
    departments: departments.map((d) => ({
      id: d.id,
      name: d.name,
      isActive: d.isActive,
      count: d._count.employees,
    })),
    unassigned,
  };
}
