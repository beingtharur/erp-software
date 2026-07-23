import { prisma } from "@/lib/db";

export async function getPipelineLeads() {
  return prisma.lead.findMany({
    orderBy: { updatedAt: "desc" },
    include: { client: true, owner: true, quotations: true },
  });
}

export async function getClientOptions() {
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getSalesReps() {
  return prisma.employee.findMany({
    where: { role: "SALES_REP", status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getClients() {
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { leads: true, projects: true, amcContracts: true } },
    },
  });
}

export async function getClientDetail(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      leads: { include: { owner: true }, orderBy: { createdAt: "desc" } },
      quotations: { orderBy: { issuedOn: "desc" } },
      siteVisits: { include: { assignedTo: true }, orderBy: { scheduledDate: "desc" } },
      amcContracts: { orderBy: { endDate: "asc" } },
      projects: true,
    },
  });
}

export async function getQuotations() {
  return prisma.quotation.findMany({
    orderBy: { issuedOn: "desc" },
    include: { client: true, lead: true },
  });
}

export async function getQuotationDetail(id: string) {
  return prisma.quotation.findUnique({
    where: { id },
    include: {
      client: true,
      lead: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function getProjects() {
  return prisma.project.findMany({
    orderBy: { startDate: "desc" },
    include: {
      client: true,
      _count: { select: { tasks: true, milestones: true } },
    },
  });
}

export async function getProjectDetail(id: string) {
  return prisma.project.findUnique({
    where: { id },
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

export async function getAssignableEmployees() {
  return prisma.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getSiteVisits() {
  return prisma.siteVisit.findMany({
    orderBy: { scheduledDate: "desc" },
    include: { client: true, assignedTo: true, project: true },
  });
}

export async function getAmcContracts() {
  return prisma.amcContract.findMany({
    orderBy: { endDate: "asc" },
    include: { client: true },
  });
}

export async function getAmcContractOptions() {
  return prisma.amcContract.findMany({
    orderBy: { contractNumber: "asc" },
    select: { id: true, contractNumber: true, clientId: true },
  });
}

export async function getTickets() {
  return prisma.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: true, amcContract: true, assignee: true },
  });
}

export async function getTicketDetail(id: string) {
  return prisma.supportTicket.findUnique({
    where: { id },
    include: { client: true, amcContract: true, assignee: true },
  });
}
