import { prisma } from "@/lib/db";
import { computeAmcStatus } from "@/lib/amc-status";

export async function getPipelineLeads(organizationId: string) {
  return prisma.lead.findMany({
    where: { client: { organizationId } },
    orderBy: { updatedAt: "desc" },
    include: { client: true, owner: true, quotations: true },
  });
}

export async function getClientOptions(organizationId: string) {
  return prisma.client.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getSalesReps(organizationId: string) {
  return prisma.employee.findMany({
    where: { role: "SALES_REP", status: "ACTIVE", organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getClients(organizationId: string) {
  return prisma.client.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { leads: true, projects: true, amcContracts: true } },
    },
  });
}

export async function getClientDetail(id: string, organizationId: string) {
  const client = await prisma.client.findFirst({
    where: { id, organizationId },
    include: {
      leads: { include: { owner: true }, orderBy: { createdAt: "desc" } },
      quotations: {
        include: { project: { select: { id: true, name: true } } },
        orderBy: { issuedOn: "desc" },
      },
      siteVisits: { include: { assignedTo: true }, orderBy: { scheduledDate: "desc" } },
      amcContracts: { orderBy: { endDate: "asc" } },
      projects: true,
    },
  });
  if (!client) return client;
  // See lib/amc-status.ts — the stored status column is never recomputed.
  return {
    ...client,
    amcContracts: client.amcContracts.map((c) => ({
      ...c,
      status: computeAmcStatus(c.endDate, c.renewalReminderDays),
    })),
  };
}

export async function getQuotations(organizationId: string) {
  return prisma.quotation.findMany({
    where: { client: { organizationId } },
    orderBy: { issuedOn: "desc" },
    include: { client: true, lead: true },
  });
}

export async function getQuotationDetail(id: string, organizationId: string) {
  return prisma.quotation.findFirst({
    where: { id, client: { organizationId } },
    include: {
      client: true,
      lead: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      project: { select: { id: true, name: true } },
    },
  });
}

export async function getProjects(organizationId: string) {
  return prisma.project.findMany({
    where: { client: { organizationId } },
    orderBy: { startDate: "desc" },
    include: {
      client: true,
      _count: { select: { tasks: true, milestones: true } },
    },
  });
}

export async function getProjectDetail(id: string, organizationId: string) {
  const project = await prisma.project.findFirst({
    where: { id, client: { organizationId } },
    include: {
      client: true,
      lead: { select: { id: true, title: true } },
      quotation: { select: { id: true, quoteNumber: true } },
      amcContracts: { orderBy: { endDate: "asc" } },
      milestones: {
        orderBy: { sortOrder: "asc" },
        include: { tasks: { include: { assignee: true }, orderBy: { createdAt: "asc" } } },
      },
      tasks: {
        where: { milestoneId: null },
        include: { assignee: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) return project;
  // See lib/amc-status.ts — the stored status column is never recomputed.
  return {
    ...project,
    amcContracts: project.amcContracts.map((c) => ({
      ...c,
      status: computeAmcStatus(c.endDate, c.renewalReminderDays),
    })),
  };
}

export async function getAssignableEmployees(organizationId: string) {
  return prisma.employee.findMany({
    where: { status: "ACTIVE", organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getSiteVisits(organizationId: string) {
  return prisma.siteVisit.findMany({
    where: { client: { organizationId } },
    orderBy: { scheduledDate: "desc" },
    include: {
      client: true,
      assignedTo: true,
      project: true,
      lead: { select: { id: true, title: true } },
      attachments: true,
    },
  });
}

export async function getProjectOptionsByClient(organizationId: string) {
  return prisma.project.findMany({
    where: { client: { organizationId } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, clientId: true },
  });
}

export async function getAmcContracts(organizationId: string) {
  const contracts = await prisma.amcContract.findMany({
    where: { client: { organizationId } },
    orderBy: { endDate: "asc" },
    include: { client: true, project: { select: { id: true, name: true } } },
  });
  // status was a static value set once at seed time and never recomputed —
  // derive the real status from endDate/renewalReminderDays on every read
  // instead of trusting the stored column (see lib/amc-status.ts).
  return contracts.map((c) => ({
    ...c,
    status: computeAmcStatus(c.endDate, c.renewalReminderDays),
  }));
}

export async function getAmcContractOptions(organizationId: string) {
  return prisma.amcContract.findMany({
    where: { client: { organizationId } },
    orderBy: { contractNumber: "asc" },
    select: { id: true, contractNumber: true, clientId: true },
  });
}

export async function getTickets(organizationId: string) {
  return prisma.supportTicket.findMany({
    where: { client: { organizationId } },
    orderBy: { createdAt: "desc" },
    include: { client: true, amcContract: true, assignee: true },
  });
}

export async function getTicketDetail(id: string, organizationId: string) {
  return prisma.supportTicket.findFirst({
    where: { id, client: { organizationId } },
    include: { client: true, amcContract: true, assignee: true },
  });
}
