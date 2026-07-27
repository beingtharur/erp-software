import { prisma } from "@/lib/db";

export async function getSites(organizationId: string) {
  return prisma.site.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: {
      client: true,
      _count: { select: { siteVisits: true, amcContracts: true, supportTickets: true } },
    },
  });
}

export async function getSiteDetail(id: string, organizationId: string) {
  return prisma.site.findFirst({
    where: { id, organizationId },
    include: {
      client: true,
      project: { select: { id: true, name: true } },
      lead: { select: { id: true, title: true } },
      siteVisits: { orderBy: { scheduledDate: "desc" }, include: { assignedTo: true } },
      amcContracts: { orderBy: { endDate: "asc" } },
      supportTickets: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getSiteOptions(organizationId: string) {
  return prisma.site.findMany({
    where: { organizationId, status: "Active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, clientId: true },
  });
}
