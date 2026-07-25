import "server-only";
import { prisma } from "@/lib/db";
import type { ManualPaymentStatus } from "@/generated/prisma/client";

export async function getPayments(status?: ManualPaymentStatus) {
  return prisma.payment.findMany({
    where: status ? { status } : undefined,
    include: {
      organization: true,
      submittedBy: { include: { employee: true } },
      reviewedBy: { include: { employee: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrganizationsOverview() {
  return prisma.organization.findMany({
    include: {
      subscription: { include: { modules: true } },
      _count: { select: { users: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
