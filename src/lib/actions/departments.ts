"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { ORG_UNIT_TYPES } from "@/lib/departments";
import type { FormActionState } from "@/lib/actions/crm";
import type { OrgUnitType } from "@/generated/prisma/client";

// Department master data is HR/Admin territory, matching the HRMS module gate.
const MANAGE_ROLES = ["ADMIN", "HR"] as const;

function revalidateDepartmentSurfaces() {
  revalidatePath("/hrms/departments");
  // Headcount-by-department on the overview, and the department pickers on the
  // employee forms.
  revalidatePath("/hrms");
  revalidatePath("/hrms/employees");
  revalidatePath("/finance/budgets");
}

/**
 * Walks up the parent chain to see whether `candidateParentId` sits underneath
 * `departmentId`. Without this, an admin could point a department at its own
 * descendant and create a cycle that would hang any future tree render — the
 * kind of thing that is much cheaper to prevent now than to unpick once
 * Sections and Teams exist.
 */
async function wouldCreateCycle(departmentId: string, candidateParentId: string) {
  let cursor: string | null = candidateParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === departmentId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    const parent: { parentId: string | null } | null = await prisma.department.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = parent?.parentId ?? null;
  }
  return false;
}

type DepartmentInput = {
  name: string;
  code: string;
  type: OrgUnitType;
  description: string | null;
  headId: string | null;
  parentId: string | null;
};

async function parseDepartmentInput(
  formData: FormData,
  organizationId: string
): Promise<{ ok: false; error: string } | { ok: true; input: DepartmentInput }> {
  const name = String(formData.get("name") ?? "").trim();
  // Codes are compared and stored uppercase so "ops" and "OPS" can't both exist.
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const description = String(formData.get("description") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "DEPARTMENT");
  const headIdRaw = String(formData.get("headId") ?? "");
  const parentIdRaw = String(formData.get("parentId") ?? "");

  if (!name || !code) {
    return { ok: false, error: "Department name and code are required." };
  }
  // Server actions take arbitrary input — check the enum rather than casting.
  if (!(ORG_UNIT_TYPES as string[]).includes(typeRaw)) {
    return { ok: false, error: "Select a valid unit type." };
  }

  const headId = headIdRaw && headIdRaw !== "none" ? headIdRaw : null;
  if (headId) {
    const head = await prisma.employee.findFirst({
      where: { id: headId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!head) return { ok: false, error: "Department head not found." };
  }

  const parentId = parentIdRaw && parentIdRaw !== "none" ? parentIdRaw : null;
  if (parentId) {
    const parent = await prisma.department.findFirst({
      where: { id: parentId, organizationId },
      select: { id: true },
    });
    if (!parent) return { ok: false, error: "Parent department not found." };
  }

  return {
    ok: true,
    input: {
      name,
      code,
      type: typeRaw as OrgUnitType,
      description: description || null,
      headId,
      parentId,
    },
  };
}

export async function createDepartment(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole([...MANAGE_ROLES]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const parsed = await parseDepartmentInput(formData, organizationId);
  if (!parsed.ok) return { error: parsed.error };

  try {
    const department = await prisma.department.create({
      data: { ...parsed.input, organizationId },
    });

    await logAudit({
      organizationId,
      actorId: user.id,
      action: "department.created",
      entityType: "Department",
      entityId: department.id,
      metadata: { name: department.name, code: department.code },
    });
  } catch (err) {
    // The unique constraint is [organizationId, code], so this can only mean a
    // clash inside this organization — never with another tenant's code.
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return { error: "A department with that code already exists." };
    }
    throw err;
  }

  revalidateDepartmentSurfaces();
  return { success: true };
}

export async function updateDepartment(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole([...MANAGE_ROLES]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const departmentId = String(formData.get("departmentId") ?? "");
  if (!departmentId) return { error: "Department not found." };

  const existing = await prisma.department.findFirst({
    where: { id: departmentId, organizationId },
    select: { id: true, name: true },
  });
  if (!existing) return { error: "Department not found." };

  const parsed = await parseDepartmentInput(formData, organizationId);
  if (!parsed.ok) return { error: parsed.error };

  if (parsed.input.parentId) {
    if (parsed.input.parentId === departmentId) {
      return { error: "A department can't report to itself." };
    }
    if (await wouldCreateCycle(departmentId, parsed.input.parentId)) {
      return { error: "That parent sits underneath this department — it would create a loop." };
    }
  }

  try {
    await prisma.department.update({ where: { id: departmentId }, data: parsed.input });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return { error: "A department with that code already exists." };
    }
    throw err;
  }

  await logAudit({
    organizationId,
    actorId: user.id,
    action: "department.updated",
    entityType: "Department",
    entityId: departmentId,
    metadata: { name: parsed.input.name, code: parsed.input.code },
  });

  revalidateDepartmentSurfaces();
  return { success: true };
}

/**
 * Deactivation rather than deletion: a department that people worked in is
 * referenced by employees and budgets, and losing that history to tidy up an
 * org chart is a bad trade. Inactive departments stop appearing in pickers but
 * keep their members and their spend.
 */
export async function setDepartmentActive(departmentId: string, isActive: boolean) {
  await requireRole([...MANAGE_ROLES]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const department = await prisma.department.findFirst({
    where: { id: departmentId, organizationId },
    select: { id: true, name: true },
  });
  if (!department) {
    throw new Error("Department not found");
  }

  await prisma.department.update({ where: { id: departmentId }, data: { isActive } });

  await logAudit({
    organizationId,
    actorId: user.id,
    action: isActive ? "department.activated" : "department.deactivated",
    entityType: "Department",
    entityId: departmentId,
    metadata: { name: department.name },
  });

  revalidateDepartmentSurfaces();
}
