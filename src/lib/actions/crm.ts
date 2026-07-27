"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { notifyRole, notifyEmployee, notifyEmployeeRole } from "@/lib/notify";
import { formatINR, formatDate, titleCase } from "@/lib/format";
import { saveFile } from "@/lib/storage";
import { withUniqueCodeRetry } from "@/lib/sequence";
import {
  LEAD_STAGE_TRANSITIONS,
  QUOTATION_STATUS_TRANSITIONS,
  MILESTONE_STATUS_TRANSITIONS,
  TICKET_STATUS_TRANSITIONS,
  PROJECT_TASK_STATUS_TRANSITIONS,
  isValidTransition,
  type LeadStage,
} from "@/lib/status-transitions";

export type FormActionState = { error?: string; success?: boolean } | undefined;

const VALID_STAGES = [
  "NEW",
  "QUALIFIED",
  "QUOTATION_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export async function createClient(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const name = String(formData.get("name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "");
  const tier = String(formData.get("tier") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactTitle = String(formData.get("contactTitle") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim().toLowerCase();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();

  if (
    !name || !industry || !tier || !city || !state ||
    !contactName || !contactTitle || !contactEmail || !contactPhone
  ) {
    return { error: "Please fill in all fields." };
  }

  await prisma.client.create({
    data: {
      name,
      industry: industry as never,
      tier,
      city,
      state,
      contactName,
      contactTitle,
      contactEmail,
      contactPhone,
      logoSeed: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      status: "Active",
      organizationId,
    },
  });

  revalidatePath("/crm/clients");
  revalidatePath("/crm");
  return { success: true };
}

export async function createLead(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const title = String(formData.get("title") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "");
  const source = String(formData.get("source") ?? "");
  const productLine = String(formData.get("productLine") ?? "");
  const value = Number(formData.get("value"));
  const probability = Number(formData.get("probability") ?? 20);
  const expectedCloseDate = String(formData.get("expectedCloseDate") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const ownerId = String(formData.get("ownerId") ?? user.employeeId ?? "");

  if (!title || !clientId || !source || !productLine || !expectedCloseDate || !ownerId) {
    return { error: "Please fill in all required fields." };
  }
  if (!Number.isFinite(value) || value <= 0) {
    return { error: "Enter a valid deal value." };
  }

  const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
  if (!client) {
    return { error: "Client not found." };
  }

  await prisma.lead.create({
    data: {
      title,
      clientId,
      source: source as never,
      productLine: productLine as never,
      value,
      probability: Number.isFinite(probability) ? probability : 20,
      expectedCloseDate: new Date(expectedCloseDate),
      ownerId,
      notes: notes || null,
    },
  });

  revalidatePath("/crm");
  revalidatePath("/");
  return { success: true };
}

export async function updateLeadStage(leadId: string, stage: LeadStage) {
  if (!VALID_STAGES.includes(stage)) {
    throw new Error("Invalid stage");
  }
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const existing = await prisma.lead.findFirst({ where: { id: leadId, client: { organizationId } } });
  if (!existing) {
    throw new Error("Lead not found");
  }
  if (!isValidTransition(LEAD_STAGE_TRANSITIONS, existing.stage as LeadStage, stage)) {
    throw new Error(`Can't move a lead from ${existing.stage} directly to ${stage}.`);
  }

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      stage,
      probability: stage === "WON" ? 100 : stage === "LOST" ? 0 : undefined,
    },
  });
  if (stage === "WON" || stage === "LOST") {
    await notifyRole(
      "ADMIN",
      organizationId,
      `Lead "${lead.title}" (${formatINR(lead.value)}) marked ${stage === "WON" ? "Won" : "Lost"}.`,
      "/crm"
    );
  }
  revalidatePath("/crm");
  revalidatePath("/");
}

export async function createQuotation(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const clientId = String(formData.get("clientId") ?? "");
  const leadId = String(formData.get("leadId") ?? "");
  const validUntil = String(formData.get("validUntil") ?? "");
  const descriptions = formData.getAll("description").map((v) => String(v).trim());
  const quantities = formData.getAll("quantity").map((v) => Number(v));
  const unitPrices = formData.getAll("unitPrice").map((v) => Number(v));

  if (!clientId || !validUntil) {
    return { error: "Please select a client and a valid-until date." };
  }

  const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
  if (!client) {
    return { error: "Client not found." };
  }

  let validLeadId: string | null = null;
  if (leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, client: { organizationId } } });
    if (!lead || lead.clientId !== clientId) {
      return { error: "Lead not found." };
    }
    validLeadId = leadId;
  }

  const lineItems = descriptions
    .map((description, i) => ({
      description,
      quantity: quantities[i],
      unitPrice: unitPrices[i],
    }))
    .filter((item) => item.description.length > 0);

  if (lineItems.length === 0) {
    return { error: "Add at least one line item." };
  }
  for (const item of lineItems) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return { error: `Enter a valid quantity for "${item.description}".` };
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
      return { error: `Enter a valid unit price for "${item.description}".` };
    }
  }

  const amount = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // quoteNumber is globally unique (not scoped per organization), so the
  // count driving it must be global too. The count-then-insert isn't atomic,
  // so wrap it in a retry: if two requests race and collide on the same
  // number, recompute a fresh count and try again instead of crashing.
  await withUniqueCodeRetry(async () => {
    const count = await prisma.quotation.count();
    const quoteNumber = `QT-${1001 + count}`;
    return prisma.quotation.create({
      data: {
        quoteNumber,
        clientId,
        leadId: validLeadId,
        amount,
        validUntil: new Date(validUntil),
        lineItems: {
          create: lineItems.map((item, i) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
            sortOrder: i,
          })),
        },
      },
    });
  });

  revalidatePath("/crm/quotations");
  revalidatePath("/crm");
  return { success: true };
}

export async function updateQuotationStatus(
  quotationId: string,
  status: "DRAFT" | "SENT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"
) {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const existing = await prisma.quotation.findFirst({
    where: { id: quotationId, client: { organizationId } },
  });
  if (!existing) {
    throw new Error("Quotation not found");
  }
  if (!isValidTransition(QUOTATION_STATUS_TRANSITIONS, existing.status, status)) {
    throw new Error(`Can't move a quotation from ${existing.status} directly to ${status}.`);
  }

  await prisma.quotation.update({
    where: { id: quotationId },
    data: { status },
  });
  revalidatePath("/crm/quotations");
  revalidatePath("/");
}

// Bump a quotation to its next revision — previously `revision` was always 1
// forever since nothing ever incremented it. Only makes sense once a client
// has actually responded (SENT/UNDER_REVIEW/REJECTED); revising resets the
// quote back to DRAFT (and its line items become editable again via
// UpdateQuotation once that exists) while keeping the same quoteNumber, so
// "QT-1042 · Revision 2" reflects a real, incrementing history.
const REVISABLE_STATUSES = ["SENT", "UNDER_REVIEW", "REJECTED"] as const;

export async function reviseQuotation(quotationId: string) {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const source = await prisma.quotation.findFirst({
    where: { id: quotationId, client: { organizationId } },
  });
  if (!source) {
    throw new Error("Quotation not found");
  }
  if (!REVISABLE_STATUSES.includes(source.status as (typeof REVISABLE_STATUSES)[number])) {
    throw new Error("Only a sent, under-review, or rejected quotation can be revised.");
  }

  const updated = await prisma.quotation.update({
    where: { id: quotationId },
    data: { revision: { increment: 1 }, status: "DRAFT" },
  });

  revalidatePath("/crm/quotations");
  revalidatePath(`/crm/quotations/${quotationId}`);
  revalidatePath("/");
  return updated;
}

export async function convertQuotationToProject(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const quotationId = String(formData.get("quotationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const productLine = String(formData.get("productLine") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const targetEndDate = String(formData.get("targetEndDate") ?? "");
  const value = Number(formData.get("value"));

  if (!quotationId || !name || !productLine || !startDate || !targetEndDate) {
    return { error: "Please fill in all required fields." };
  }
  if (!Number.isFinite(value) || value <= 0) {
    return { error: "Enter a valid project value." };
  }

  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, client: { organizationId } },
    include: { client: true, project: true },
  });
  if (!quotation) {
    return { error: "Quotation not found." };
  }
  if (quotation.status !== "APPROVED") {
    return { error: "Only approved quotations can be converted." };
  }
  if (quotation.project) {
    return { error: "Project already created." };
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description || null,
      clientId: quotation.clientId,
      leadId: quotation.leadId,
      quotationId: quotation.id,
      productLine: productLine as never,
      industry: quotation.client.industry,
      value,
      startDate: new Date(startDate),
      targetEndDate: new Date(targetEndDate),
    },
  });

  await Promise.all([
    notifyEmployeeRole(
      "PROJECT_MANAGER",
      organizationId,
      `New project "${name}" created from quotation ${quotation.quoteNumber} — ${quotation.client.name}.`,
      `/crm/projects/${project.id}`
    ),
    notifyRole(
      "ADMIN",
      organizationId,
      `New project "${name}" created from quotation ${quotation.quoteNumber} — ${quotation.client.name}.`,
      `/crm/projects/${project.id}`
    ),
  ]);

  revalidatePath(`/crm/quotations/${quotationId}`);
  revalidatePath("/crm/quotations");
  revalidatePath("/crm/projects");
  revalidatePath(`/crm/projects/${project.id}`);
  revalidatePath(`/crm/clients/${quotation.clientId}`);
  revalidatePath("/crm");
  revalidatePath("/");
  return { success: true };
}

const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB

async function loadVisitForMutation(visitId: string, organizationId: string) {
  const visit = await prisma.siteVisit.findFirst({
    where: { id: visitId, client: { organizationId } },
  });
  if (!visit) {
    throw new Error("Site visit not found");
  }
  return visit;
}

function assertCanManageVisit(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  visit: { assignedToId: string }
) {
  const allowed =
    user.accessRole === "ADMIN" ||
    user.accessRole === "SALES" ||
    user.employeeId === visit.assignedToId;
  if (!allowed) {
    throw new Error("Not authorized to update this visit.");
  }
}

export async function createSiteVisit(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const leadId = String(formData.get("leadId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const visitType = String(formData.get("visitType") ?? "SALES");
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const purpose = String(formData.get("purpose") ?? "").trim();
  const scheduledDate = String(formData.get("scheduledDate") ?? "");
  const scheduledTime = String(formData.get("scheduledTime") ?? "").trim() || "09:00";
  const assignedToId = String(formData.get("assignedToId") ?? "");
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const addressLine = String(formData.get("addressLine") ?? "").trim();
  const landmark = String(formData.get("landmark") ?? "").trim();
  const mapsLink = String(formData.get("mapsLink") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!clientId || !purpose || !scheduledDate || !assignedToId) {
    return { error: "Please fill in all required fields." };
  }

  const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
  if (!client) {
    return { error: "Client not found." };
  }

  if (leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, client: { organizationId } } });
    if (!lead || lead.clientId !== clientId) {
      return { error: "Lead not found." };
    }
  }

  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, client: { organizationId } } });
    if (!project) {
      return { error: "Project not found." };
    }
  }

  const assignee = await prisma.employee.findFirst({ where: { id: assignedToId, organizationId } });
  if (!assignee) {
    return { error: "Assigned employee not found." };
  }

  const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { error: "Enter a valid date and time." };
  }

  await prisma.siteVisit.create({
    data: {
      clientId,
      projectId: projectId || null,
      leadId: leadId || null,
      purpose,
      visitType: visitType as never,
      priority: priority as never,
      scheduledDate: scheduledAt,
      assignedToId,
      contactName: contactName || null,
      contactPhone: contactPhone || null,
      contactEmail: contactEmail || null,
      addressLine: addressLine || null,
      landmark: landmark || null,
      mapsLink: mapsLink || null,
      notes: notes || null,
    },
  });

  await notifyEmployee(
    assignedToId,
    `New site visit scheduled: ${purpose} — ${client.name} on ${formatDate(scheduledAt)}.`,
    "/me"
  );

  revalidatePath("/crm/site-visits");
  revalidatePath("/crm");
  revalidatePath(`/crm/clients/${clientId}`);
  revalidatePath("/me");
  revalidatePath("/");
  return { success: true };
}

export async function startVisit(visitId: string) {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const visit = await loadVisitForMutation(visitId, organizationId);
  assertCanManageVisit(user, visit);

  if (visit.status !== "SCHEDULED" && visit.status !== "RESCHEDULED") {
    throw new Error("Visit already started or finished.");
  }

  await prisma.siteVisit.update({
    where: { id: visitId },
    data: { status: "IN_PROGRESS", actualStartTime: new Date() },
  });

  revalidatePath("/crm/site-visits");
  revalidatePath("/me");
  revalidatePath("/");
}

export async function rescheduleSiteVisit(visitId: string, newScheduledDate: string, reason: string) {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const visit = await loadVisitForMutation(visitId, organizationId);
  assertCanManageVisit(user, visit);

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("A reason is required to reschedule.");
  }

  const scheduledAt = new Date(newScheduledDate);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Enter a valid date and time.");
  }

  await prisma.siteVisit.update({
    where: { id: visitId },
    data: { status: "RESCHEDULED", scheduledDate: scheduledAt, rescheduleReason: trimmedReason },
  });

  await notifyEmployee(
    visit.assignedToId,
    `Site visit rescheduled to ${formatDate(scheduledAt)}: ${trimmedReason}`,
    "/me"
  );

  revalidatePath("/crm/site-visits");
  revalidatePath("/me");
  revalidatePath("/");
}

export async function completeSiteVisit(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const visitId = String(formData.get("visitId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const outcomeNotes = String(formData.get("outcomeNotes") ?? "").trim();
  const customerFeedback = String(formData.get("customerFeedback") ?? "").trim();
  const recommendedAction = String(formData.get("recommendedAction") ?? "");
  const recommendedActionNotes = String(formData.get("recommendedActionNotes") ?? "").trim();
  const followUpDate = String(formData.get("followUpDate") ?? "");
  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!visitId || !outcome) {
    return { error: "Select an outcome before completing this visit." };
  }
  if (photos.length > 0 && !user.employeeId) {
    return { error: "No employee record linked to this account — can't attach photos." };
  }
  for (const photo of photos) {
    if (photo.size > MAX_PHOTO_SIZE) {
      return { error: `"${photo.name}" is too large (max 10MB).` };
    }
  }

  const visit = await loadVisitForMutation(visitId, organizationId);
  try {
    assertCanManageVisit(user, visit);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized to update this visit." };
  }

  const now = new Date();
  const durationMinutes = visit.actualStartTime
    ? Math.round((now.getTime() - visit.actualStartTime.getTime()) / 60000)
    : null;

  await prisma.siteVisit.update({
    where: { id: visitId },
    data: {
      status: "COMPLETED",
      actualEndTime: now,
      durationMinutes,
      outcome: outcome as never,
      outcomeNotes: outcomeNotes || null,
      customerFeedback: customerFeedback || null,
      recommendedAction: recommendedAction ? (recommendedAction as never) : null,
      recommendedActionNotes: recommendedActionNotes || null,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
    },
  });

  if (user.employeeId) {
    for (const photo of photos) {
      const { url, storageKey } = await saveFile(photo, `site-visits/${visitId}`);
      await prisma.siteVisitAttachment.create({
        data: {
          siteVisitId: visitId,
          fileUrl: url,
          storageKey,
          fileName: photo.name,
          fileSize: photo.size,
          uploadedById: user.employeeId,
        },
      });
    }
  }

  if (visit.leadId) {
    const [lead, client] = await Promise.all([
      prisma.lead.findUnique({ where: { id: visit.leadId } }),
      prisma.client.findUnique({ where: { id: visit.clientId } }),
    ]);
    if (lead && client) {
      await notifyEmployee(
        lead.ownerId,
        `Site visit completed — ${client.name}: ${titleCase(outcome)}.`,
        "/crm/site-visits"
      );
    }
  }

  revalidatePath("/crm/site-visits");
  revalidatePath("/crm");
  revalidatePath(`/crm/clients/${visit.clientId}`);
  revalidatePath("/me");
  revalidatePath("/");
  return { success: true };
}

export async function cancelSiteVisit(visitId: string) {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const visit = await loadVisitForMutation(visitId, organizationId);
  assertCanManageVisit(user, visit);

  await prisma.siteVisit.update({
    where: { id: visitId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/crm/site-visits");
  revalidatePath("/me");
  revalidatePath("/");
}

export async function createMilestone(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "");

  if (!projectId || !title || !dueDate) {
    return { error: "Please fill in all fields." };
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, client: { organizationId } } });
  if (!project) {
    return { error: "Project not found." };
  }

  const count = await prisma.milestone.count({ where: { projectId } });
  await prisma.milestone.create({
    data: { projectId, title, dueDate: new Date(dueDate), sortOrder: count },
  });

  revalidatePath(`/crm/projects/${projectId}`);
  return { success: true };
}

export async function updateMilestoneStatus(
  milestoneId: string,
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED"
) {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const existing = await prisma.milestone.findFirst({
    where: { id: milestoneId, project: { client: { organizationId } } },
  });
  if (!existing) {
    throw new Error("Milestone not found");
  }
  if (!isValidTransition(MILESTONE_STATUS_TRANSITIONS, existing.status, status)) {
    throw new Error(`Can't move a milestone from ${existing.status} directly to ${status}.`);
  }

  const milestone = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status },
  });
  revalidatePath(`/crm/projects/${milestone.projectId}`);
}

export async function createProjectTask(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const projectId = String(formData.get("projectId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");

  if (!projectId || !title) {
    return { error: "Give the task a title." };
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, client: { organizationId } } });
  if (!project) {
    return { error: "Project not found." };
  }

  await prisma.projectTask.create({
    data: {
      projectId,
      milestoneId: milestoneId || null,
      title,
      assigneeId: assigneeId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  revalidatePath(`/crm/projects/${projectId}`);
  return { success: true };
}

export async function updateProjectTaskStatus(
  taskId: string,
  status: "TODO" | "IN_PROGRESS" | "DONE"
) {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const existing = await prisma.projectTask.findFirst({
    where: { id: taskId, project: { client: { organizationId } } },
  });
  if (!existing) {
    throw new Error("Task not found");
  }
  if (!isValidTransition(PROJECT_TASK_STATUS_TRANSITIONS, existing.status, status)) {
    throw new Error(`Can't move a task from ${existing.status} directly to ${status}.`);
  }

  const task = await prisma.projectTask.update({
    where: { id: taskId },
    data: { status },
  });

  // Progress is derived from real task completion, not a manually-set number —
  // recompute it whenever a task moves.
  const [total, done] = await Promise.all([
    prisma.projectTask.count({ where: { projectId: task.projectId } }),
    prisma.projectTask.count({ where: { projectId: task.projectId, status: "DONE" } }),
  ]);
  if (total > 0) {
    await prisma.project.update({
      where: { id: task.projectId },
      data: { progressPercent: Math.round((done / total) * 100) },
    });
  }

  revalidatePath(`/crm/projects/${task.projectId}`);
  revalidatePath("/crm/projects");
  revalidatePath("/");
}

export async function createTicket(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const clientId = String(formData.get("clientId") ?? "");
  const amcContractId = String(formData.get("amcContractId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const assigneeId = String(formData.get("assigneeId") ?? "");

  if (!clientId || !subject || !description) {
    return { error: "Please fill in all required fields." };
  }

  const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
  if (!client) {
    return { error: "Client not found." };
  }

  let ticketNumber = "";
  await withUniqueCodeRetry(async () => {
    // ticketNumber is globally unique (not scoped per organization), so the
    // count driving it must be global too; retry on collision (see sequence.ts).
    const count = await prisma.supportTicket.count();
    ticketNumber = `TKT-${1001 + count}`;
    return prisma.supportTicket.create({
      data: {
        ticketNumber,
        clientId,
        amcContractId: amcContractId || null,
        subject,
        description,
        priority: priority as never,
        assigneeId: assigneeId || null,
      },
    });
  });

  if (priority === "CRITICAL") {
    await notifyRole(
      "ADMIN",
      organizationId,
      `Critical ticket ${ticketNumber} raised: "${subject}".`,
      "/crm/helpdesk"
    );
  }
  if (assigneeId) {
    await notifyEmployee(assigneeId, `Ticket ${ticketNumber} assigned to you: "${subject}".`, "/crm/helpdesk");
  }

  revalidatePath("/crm/helpdesk");
  revalidatePath("/");
  return { success: true };
}

export async function updateTicketStatus(
  ticketId: string,
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
) {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const existing = await prisma.supportTicket.findFirst({
    where: { id: ticketId, client: { organizationId } },
  });
  if (!existing) {
    throw new Error("Ticket not found");
  }
  if (!isValidTransition(TICKET_STATUS_TRANSITIONS, existing.status, status)) {
    throw new Error(`Can't move a ticket from ${existing.status} directly to ${status}.`);
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
    },
  });
  revalidatePath("/crm/helpdesk");
  revalidatePath(`/crm/helpdesk/${ticketId}`);
  revalidatePath("/");
}

export async function assignTicket(ticketId: string, assigneeId: string) {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const existing = await prisma.supportTicket.findFirst({
    where: { id: ticketId, client: { organizationId } },
  });
  if (!existing) {
    throw new Error("Ticket not found");
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { assigneeId: assigneeId || null },
  });

  // Notify the newly assigned employee — previously only CRITICAL ticket
  // *creation* notified anyone; reassignment was silent.
  if (assigneeId && assigneeId !== existing.assigneeId) {
    await notifyEmployee(
      assigneeId,
      `Ticket ${existing.ticketNumber} assigned to you: "${existing.subject}".`,
      "/crm/helpdesk"
    );
  }

  revalidatePath("/crm/helpdesk");
  revalidatePath(`/crm/helpdesk/${ticketId}`);
}

export async function resolveTicket(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const ticketId = String(formData.get("ticketId") ?? "");
  const resolutionNotes = String(formData.get("resolutionNotes") ?? "").trim();

  if (!ticketId || !resolutionNotes) {
    return { error: "Add resolution notes before resolving." };
  }

  const result = await prisma.supportTicket.updateMany({
    where: { id: ticketId, client: { organizationId } },
    data: { status: "RESOLVED", resolutionNotes, resolvedAt: new Date() },
  });
  if (result.count === 0) {
    return { error: "Ticket not found." };
  }

  revalidatePath("/crm/helpdesk");
  revalidatePath(`/crm/helpdesk/${ticketId}`);
  revalidatePath("/");
  return { success: true };
}

export async function createAmcContract(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const clientId = String(formData.get("clientId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const contractName = String(formData.get("contractName") ?? "").trim();
  const equipmentCovered = String(formData.get("equipmentCovered") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const value = Number(formData.get("value"));
  const coverage = String(formData.get("coverage") ?? "").trim();
  const visitsIncluded = Number(formData.get("visitsIncluded"));
  const responseTime = String(formData.get("responseTime") ?? "").trim();
  const billingFrequency = String(formData.get("billingFrequency") ?? "");
  const renewalReminderDays = Number(formData.get("renewalReminderDays"));
  const nextServiceDate = String(formData.get("nextServiceDate") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!clientId || !equipmentCovered || !startDate || !endDate) {
    return { error: "Please fill in all required fields." };
  }
  if (!Number.isFinite(value) || value <= 0) {
    return { error: "Enter a valid contract value." };
  }

  const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
  if (!client) {
    return { error: "Client not found." };
  }

  let project: { id: string; name: string; status: string } | null = null;
  if (projectId) {
    project = await prisma.project.findFirst({
      where: { id: projectId, client: { organizationId } },
      select: { id: true, name: true, status: true },
    });
    if (!project) {
      return { error: "Project not found." };
    }
    if (project.status !== "COMPLETED") {
      return { error: "AMC contracts can only be created for completed projects." };
    }
  }

  // contractNumber is globally unique (not scoped per organization), so the
  // count driving it must be global too — matches the seed data's AMC-501+
  // scheme. Retry on collision (see sequence.ts) since count-then-insert isn't atomic.
  const createdContract = await withUniqueCodeRetry(async () => {
    const count = await prisma.amcContract.count();
    const contractNumber = `AMC-${501 + count}`;
    return prisma.amcContract.create({
      data: {
        contractNumber,
        clientId,
        projectId: projectId || null,
        contractName: contractName || null,
        equipmentCovered,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        value,
        coverage: coverage || null,
        visitsIncluded: Number.isFinite(visitsIncluded) && visitsIncluded > 0 ? visitsIncluded : null,
        responseTime: responseTime || null,
        billingFrequency: billingFrequency ? (billingFrequency as never) : null,
        renewalReminderDays:
          Number.isFinite(renewalReminderDays) && renewalReminderDays > 0 ? renewalReminderDays : null,
        // Previously always null until someone recorded a service — letting
        // it be set at creation means a new contract can show a real "Next
        // Service" date on day one instead of "—" forever.
        nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
        notes: notes || null,
      },
    });
  });

  await notifyRole(
    "SALES",
    organizationId,
    `AMC ready for review: ${contractName || createdContract.contractNumber} — ${client.name}.`,
    "/crm/amc"
  );

  revalidatePath("/crm/amc");
  revalidatePath(`/crm/clients/${clientId}`);
  if (projectId) {
    revalidatePath(`/crm/projects/${projectId}`);
  }
  revalidatePath("/crm");
  revalidatePath("/");
  return { success: true };
}

// Previously there was no way to ever record a completed service visit —
// lastServiceDate/nextServiceDate could only ever be set once, at creation
// (see the nextServiceDate field above), and then stayed frozen forever.
export async function recordAmcService(
  contractId: string,
  serviceDate: string,
  nextServiceDate: string
) {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const parsedServiceDate = new Date(serviceDate);
  if (Number.isNaN(parsedServiceDate.getTime())) {
    throw new Error("Enter a valid service date.");
  }
  const parsedNextServiceDate = nextServiceDate ? new Date(nextServiceDate) : null;
  if (nextServiceDate && Number.isNaN(parsedNextServiceDate!.getTime())) {
    throw new Error("Enter a valid next-service date.");
  }

  const result = await prisma.amcContract.updateMany({
    where: { id: contractId, client: { organizationId } },
    data: { lastServiceDate: parsedServiceDate, nextServiceDate: parsedNextServiceDate },
  });
  if (result.count === 0) {
    throw new Error("AMC contract not found");
  }

  revalidatePath("/crm/amc");
  revalidatePath("/");
}
