import { prisma } from "@/lib/db";

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
  return prisma.client.findFirst({
    where: { id, organizationId },
    include: {
      leads: { include: { owner: true }, orderBy: { createdAt: "desc" } },
      quotations: { orderBy: { issuedOn: "desc" } },
      siteVisits: { include: { assignedTo: true }, orderBy: { scheduledDate: "desc" } },
      amcContracts: { orderBy: { endDate: "asc" } },
      projects: true,
    },
  });
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
  return prisma.project.findFirst({
    where: { id, client: { organizationId } },
    include: {
      client: true,
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
    include: { client: true, assignedTo: true, project: true },
  });
}

export async function getAmcContracts(organizationId: string) {
  return prisma.amcContract.findMany({
    where: { client: { organizationId } },
    orderBy: { endDate: "asc" },
    include: { client: true },
  });
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
