"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { notifyRole } from "@/lib/notify";
import { formatINR } from "@/lib/format";

export type FormActionState = { error?: string; success?: boolean } | undefined;

const VALID_STAGES = [
  "NEW",
  "QUALIFIED",
  "QUOTATION_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;
type LeadStage = (typeof VALID_STAGES)[number];

export async function createLead(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();

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

  const clientId = String(formData.get("clientId") ?? "");
  const validUntil = String(formData.get("validUntil") ?? "");
  const descriptions = formData.getAll("description").map((v) => String(v).trim());
  const quantities = formData.getAll("quantity").map((v) => Number(v));
  const unitPrices = formData.getAll("unitPrice").map((v) => Number(v));

  if (!clientId || !validUntil) {
    return { error: "Please select a client and a valid-until date." };
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
  const count = await prisma.quotation.count();
  const quoteNumber = `QT-${1001 + count}`;

  await prisma.quotation.create({
    data: {
      quoteNumber,
      clientId,
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

  revalidatePath("/crm/quotations");
  revalidatePath("/crm");
  return { success: true };
}

export async function updateQuotationStatus(
  quotationId: string,
  status: "DRAFT" | "SENT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"
) {
  await prisma.quotation.update({
    where: { id: quotationId },
    data: { status },
  });
  revalidatePath("/crm/quotations");
  revalidatePath("/");
}

export async function updateSiteVisitStatus(
  visitId: string,
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED"
) {
  await prisma.siteVisit.update({
    where: { id: visitId },
    data: { status },
  });
  revalidatePath("/crm/site-visits");
  revalidatePath("/");
}

export async function createMilestone(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "SALES"]);

  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "");

  if (!projectId || !title || !dueDate) {
    return { error: "Please fill in all fields." };
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

  const projectId = String(formData.get("projectId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");

  if (!projectId || !title) {
    return { error: "Give the task a title." };
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

  const clientId = String(formData.get("clientId") ?? "");
  const amcContractId = String(formData.get("amcContractId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const assigneeId = String(formData.get("assigneeId") ?? "");

  if (!clientId || !subject || !description) {
    return { error: "Please fill in all required fields." };
  }

  const count = await prisma.supportTicket.count();
  const ticketNumber = `TKT-${1001 + count}`;

  await prisma.supportTicket.create({
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

  if (priority === "CRITICAL") {
    await notifyRole(
      "ADMIN",
      `Critical ticket ${ticketNumber} raised: "${subject}".`,
      "/crm/helpdesk"
    );
  }

  revalidatePath("/crm/helpdesk");
  revalidatePath("/");
  return { success: true };
}

export async function updateTicketStatus(
  ticketId: string,
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
) {
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
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { assigneeId: assigneeId || null },
  });
  revalidatePath("/crm/helpdesk");
  revalidatePath(`/crm/helpdesk/${ticketId}`);
}

export async function resolveTicket(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const resolutionNotes = String(formData.get("resolutionNotes") ?? "").trim();

  if (!ticketId || !resolutionNotes) {
    return { error: "Add resolution notes before resolving." };
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "RESOLVED", resolutionNotes, resolvedAt: new Date() },
  });

  revalidatePath("/crm/helpdesk");
  revalidatePath(`/crm/helpdesk/${ticketId}`);
  revalidatePath("/");
  return { success: true };
}
