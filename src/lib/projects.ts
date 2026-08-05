import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { notifyEmployeeRole, notifyRole } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import type { Industry, ProductLine } from "@/generated/prisma/client";

/**
 * A project can now be born two ways — converted from an approved quotation, or
 * created directly on the Projects page. Everything that happens *after* the row
 * exists must be identical between them (defaults, who gets notified, the audit
 * trail, which pages go stale), so both callers share this module and neither
 * owns a private copy of that logic. The only thing a caller decides is where
 * clientId / leadId / quotationId came from.
 */

export const PRODUCT_LINES = [
  "PROCESS_EQUIPMENT",
  "CONTAINMENT_SYSTEMS",
  "PIPING_DISTRIBUTION",
  "TURNKEY_PROJECTS",
] as const;

export type ProjectFields = {
  name: string;
  description: string | null;
  productLine: ProductLine;
  value: number;
  startDate: Date;
  targetEndDate: Date;
};

// Discriminated on a literal `ok` rather than on the presence of `error`: a
// `string` property is not a unit type, so TypeScript won't narrow the union
// through `if (parsed.error)` and callers would lose type safety on `fields`.
export type ParsedProjectFields =
  | { ok: false; error: string }
  | { ok: true; fields: ProjectFields };

/**
 * Shared parse + validation for the fields both creation forms collect.
 * Server Actions take arbitrary client input, so productLine is checked against
 * the enum rather than cast blindly, and the date ordering is enforced here so
 * neither path can create a project that ends before it starts.
 */
export function parseProjectFields(formData: FormData): ParsedProjectFields {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const productLine = String(formData.get("productLine") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const targetEndDate = String(formData.get("targetEndDate") ?? "");
  const value = Number(formData.get("value"));

  if (!name || !productLine || !startDate || !targetEndDate) {
    return { ok: false, error: "Please fill in all required fields." };
  }
  if (!(PRODUCT_LINES as readonly string[]).includes(productLine)) {
    return { ok: false, error: "Select a valid product line." };
  }
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: "Enter a valid project value." };
  }

  const start = new Date(startDate);
  const end = new Date(targetEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Enter valid start and target end dates." };
  }
  if (end < start) {
    return { ok: false, error: "Target end date must be on or after the start date." };
  }

  return {
    ok: true,
    fields: {
      name,
      description: description || null,
      productLine: productLine as ProductLine,
      value,
      startDate: start,
      targetEndDate: end,
    },
  };
}

export type ProjectOrigin =
  | { kind: "manual" }
  | { kind: "quotation"; quotationId: string; quoteNumber: string; leadId: string | null };

/**
 * Creates the project row and runs every post-creation side effect. Project
 * carries no organizationId of its own (it is scoped through client), so the
 * caller must have already resolved `client` inside the acting user's org —
 * that lookup is the org-isolation boundary for both paths.
 */
export async function initializeProject({
  organizationId,
  actorUserId,
  client,
  fields,
  origin,
}: {
  organizationId: string;
  actorUserId: string;
  client: { id: string; name: string; industry: Industry };
  fields: ProjectFields;
  origin: ProjectOrigin;
}) {
  const project = await prisma.project.create({
    data: {
      name: fields.name,
      description: fields.description,
      clientId: client.id,
      leadId: origin.kind === "quotation" ? origin.leadId : null,
      quotationId: origin.kind === "quotation" ? origin.quotationId : null,
      productLine: fields.productLine,
      // Industry is always inherited from the client rather than asked for —
      // a project can't be in a different industry than the company it's for.
      industry: client.industry,
      value: fields.value,
      startDate: fields.startDate,
      targetEndDate: fields.targetEndDate,
      // status (PLANNING) and progressPercent (0) come from the schema defaults
      // so neither path can seed a project into a different starting state.
    },
  });

  const message =
    origin.kind === "quotation"
      ? `New project "${fields.name}" created from quotation ${origin.quoteNumber} — ${client.name}.`
      : `New project "${fields.name}" created for ${client.name}.`;
  const href = `/crm/projects/${project.id}`;

  await Promise.all([
    notifyEmployeeRole("PROJECT_MANAGER", organizationId, message, href),
    notifyRole("ADMIN", organizationId, message, href),
  ]);

  await logAudit({
    organizationId,
    actorId: actorUserId,
    action: "project.created",
    entityType: "Project",
    entityId: project.id,
    metadata: {
      origin: origin.kind,
      clientId: client.id,
      value: fields.value,
      ...(origin.kind === "quotation"
        ? { quotationId: origin.quotationId, leadId: origin.leadId }
        : {}),
    },
  });

  revalidatePath("/crm/projects");
  revalidatePath(href);
  revalidatePath(`/crm/clients/${client.id}`);
  revalidatePath("/crm");
  // Both pages offer a project picker sourced from the full project list
  // (timesheet logging and site-visit scheduling), so a new project has to
  // invalidate them or it stays missing from the dropdown.
  revalidatePath("/crm/site-visits");
  revalidatePath("/me");
  // Dashboard KPIs count active projects and group them by product line.
  revalidatePath("/");

  return project;
}
