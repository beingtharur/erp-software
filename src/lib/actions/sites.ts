"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import type { FormActionState } from "@/lib/actions/crm";

// A soft duplicate guard, not a hard unique constraint — a client legitimately
// might have two sites with the same name (e.g. two "Plant 2"s under
// different addresses), so we warn and let the user confirm rather than block.
// The client resubmits with confirmDuplicate=1 once they've seen the warning.
const DUPLICATE_PREFIX = "duplicate:";

export async function createSite(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const clientId = String(formData.get("clientId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const leadId = String(formData.get("leadId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const addressLine = String(formData.get("addressLine") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const pincode = String(formData.get("pincode") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const confirmDuplicate = formData.get("confirmDuplicate") === "1";

  if (!clientId || !name) {
    return { error: "Please select a client and enter a site name." };
  }

  const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
  if (!client) {
    return { error: "Client not found." };
  }

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, client: { organizationId } },
    });
    if (!project || project.clientId !== clientId) {
      return { error: "Project not found for this client." };
    }
  }

  if (leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, client: { organizationId } } });
    if (!lead || lead.clientId !== clientId) {
      return { error: "Lead not found for this client." };
    }
  }

  if (!confirmDuplicate) {
    // SQLite has no case-insensitive `mode` filter in Prisma, so this small,
    // per-client set is compared in JS instead.
    const clientSites = await prisma.site.findMany({ where: { clientId }, select: { name: true } });
    const isDuplicate = clientSites.some((s) => s.name.trim().toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      return {
        error: `${DUPLICATE_PREFIX}A site named "${name}" already exists for ${client.name}. Submit again to create it anyway.`,
      };
    }
  }

  // Site is a new model with no legacy cross-tenant numbering to match, so
  // the counter is scoped per organization from the start.
  const count = await prisma.site.count({ where: { organizationId } });
  const siteCode = `SITE-${String(count + 1).padStart(3, "0")}`;

  await prisma.site.create({
    data: {
      siteCode,
      name,
      clientId,
      projectId: projectId || null,
      leadId: leadId || null,
      addressLine: addressLine || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      contactName: contactName || null,
      contactPhone: contactPhone || null,
      organizationId,
    },
  });

  revalidatePath("/crm/sites");
  revalidatePath(`/crm/clients/${clientId}`);
  return { success: true };
}

export async function updateSite(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const siteId = String(formData.get("siteId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const addressLine = String(formData.get("addressLine") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const pincode = String(formData.get("pincode") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const status = String(formData.get("status") ?? "Active");

  if (!siteId || !name) {
    return { error: "Enter a site name." };
  }

  const site = await prisma.site.findFirst({ where: { id: siteId, organizationId } });
  if (!site) {
    return { error: "Site not found." };
  }

  await prisma.site.update({
    where: { id: siteId },
    data: {
      name,
      addressLine: addressLine || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      contactName: contactName || null,
      contactPhone: contactPhone || null,
      status,
    },
  });

  revalidatePath("/crm/sites");
  revalidatePath(`/crm/sites/${siteId}`);
  return { success: true };
}
