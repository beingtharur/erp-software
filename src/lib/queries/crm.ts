import { prisma } from "@/lib/db";
import { computeAmcStatus } from "@/lib/amc-status";
import type { LeadStage, LeadSource, ProductLine, Industry, QuotationStatus } from "@/generated/prisma/client";

export async function getPipelineLeads(organizationId: string) {
  return prisma.lead.findMany({
    where: { client: { organizationId } },
    orderBy: { updatedAt: "desc" },
    include: { client: true, owner: true, quotations: true },
  });
}

export type LeadExportFilters = {
  stage?: string;
  source?: string;
  productLine?: string;
  ownerId?: string;
  expectedCloseFrom?: Date;
  expectedCloseTo?: Date;
};

// No default date range — a pipeline register reads as "every lead," open
// or closed, same convention as Vendor/Purchase Order Export.
export async function getLeadsForExport(organizationId: string, filters: LeadExportFilters) {
  const expectedCloseFilter =
    filters.expectedCloseFrom || filters.expectedCloseTo
      ? {
          ...(filters.expectedCloseFrom ? { gte: filters.expectedCloseFrom } : {}),
          ...(filters.expectedCloseTo ? { lte: filters.expectedCloseTo } : {}),
        }
      : undefined;

  return prisma.lead.findMany({
    where: {
      client: { organizationId },
      stage: filters.stage ? (filters.stage as LeadStage) : undefined,
      source: filters.source ? (filters.source as LeadSource) : undefined,
      productLine: filters.productLine ? (filters.productLine as ProductLine) : undefined,
      ownerId: filters.ownerId || undefined,
      expectedCloseDate: expectedCloseFilter,
    },
    orderBy: { createdAt: "desc" },
    include: { client: true, owner: true },
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
    where: { role: "SALES_REP", status: "ACTIVE", organizationId, deletedAt: null },
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

export type ClientExportFilters = {
  industry?: string;
  tier?: string;
  city?: string;
  state?: string;
  status?: string;
};

// No default date filter at all — Client is master data (like Employee/
// Vendor), and there's no natural date field to filter a "customer
// register" by beyond createdAt, which isn't part of the approved filter
// set for this export.
export async function getClientsForExport(organizationId: string, filters: ClientExportFilters) {
  return prisma.client.findMany({
    where: {
      organizationId,
      industry: filters.industry ? (filters.industry as Industry) : undefined,
      tier: filters.tier || undefined,
      city: filters.city || undefined,
      state: filters.state || undefined,
      status: filters.status || undefined,
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { leads: true, projects: true } },
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

export type QuotationFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  clientId?: string;
  status?: string;
  revision?: number;
};

// lineItems is additive to the include — the list page ignores the extra
// field, and the export (System Quoted's fallback when no lead is linked)
// needs it. No default date range — a quotation register is register data
// (like Vendor/Lead/Client), not a recurring daily log.
export async function getQuotations(organizationId: string, filters: QuotationFilters = {}) {
  const issuedOnFilter =
    filters.dateFrom || filters.dateTo
      ? {
          ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
          ...(filters.dateTo ? { lte: filters.dateTo } : {}),
        }
      : undefined;

  return prisma.quotation.findMany({
    where: {
      client: { organizationId },
      clientId: filters.clientId || undefined,
      status: filters.status ? (filters.status as QuotationStatus) : undefined,
      revision: filters.revision || undefined,
      issuedOn: issuedOnFilter,
    },
    orderBy: { issuedOn: "desc" },
    include: { client: true, lead: true, lineItems: { orderBy: { sortOrder: "asc" } } },
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
    where: { status: "ACTIVE", organizationId, deletedAt: null },
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

export async function getLeadOptionsByClient(organizationId: string) {
  return prisma.lead.findMany({
    where: { client: { organizationId } },
    orderBy: { title: "asc" },
    select: { id: true, title: true, clientId: true },
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
