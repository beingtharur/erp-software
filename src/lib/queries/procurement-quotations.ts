import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type ProcurementQuotationFilters = {
  status?: string;
  search?: string;
};

// Latest-version rows only — version history is a separate lookup
// (getProcurementQuotationVersions) so the main list stays one row per
// logical quotation regardless of how many times it's been re-uploaded.
export async function getProcurementQuotations(organizationId: string, filters: ProcurementQuotationFilters = {}) {
  const where: Prisma.ProcurementQuotationWhereInput = { organizationId, isLatest: true };
  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status as never;
  }
  if (filters.search) {
    where.OR = [
      { quotationNumber: { contains: filters.search } },
      { vendorName: { contains: filters.search } },
      { projectName: { contains: filters.search } },
      { clientName: { contains: filters.search } },
    ];
  }

  return prisma.procurementQuotation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
}

export async function getProcurementQuotationVersions(groupId: string, organizationId: string) {
  return prisma.procurementQuotation.findMany({
    where: { groupId, organizationId },
    orderBy: { version: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
}
