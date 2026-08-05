import { prisma } from "@/lib/db";
import { computeVendorPaymentStatus } from "@/lib/payment-status";

export async function getVendors(organizationId: string) {
  return prisma.vendor.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { purchaseOrders: true, payments: true } },
    },
  });
}

export async function getPurchaseOrders(organizationId: string) {
  return prisma.purchaseOrder.findMany({
    where: { vendor: { organizationId } },
    orderBy: { orderDate: "desc" },
    include: { vendor: true },
  });
}

export async function getVendorOptions(organizationId: string) {
  return prisma.vendor.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getVendorDetail(id: string, organizationId: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { id, organizationId },
    include: {
      purchaseOrders: { orderBy: { orderDate: "desc" } },
      payments: { orderBy: { dueDate: "desc" }, include: { purchaseOrder: true } },
    },
  });
  if (!vendor) return vendor;
  // See lib/payment-status.ts — OVERDUE was only ever set once at seed time.
  return {
    ...vendor,
    payments: vendor.payments.map((p) => ({ ...p, status: computeVendorPaymentStatus(p) })),
  };
}

export async function getVendorPayments(organizationId: string) {
  const payments = await prisma.vendorPayment.findMany({
    where: { vendor: { organizationId } },
    orderBy: { dueDate: "asc" },
    include: { vendor: true, purchaseOrder: true },
  });

  // A payment awaiting maker-checker confirmation (see requestPaymentConfirmation
  // / decideApproval's PAYMENT_CONFIRMATION case) is still VendorPayment.status
  // PENDING until an admin approves it — surfaced separately here so the
  // Payments page can distinguish "not yet submitted for confirmation" from
  // "awaiting another admin's review" instead of showing the same Pending badge
  // for both.
  const pendingConfirmations = await prisma.approvalRequest.findMany({
    where: {
      entityType: "PAYMENT_CONFIRMATION",
      status: "PENDING",
      entityId: { in: payments.map((p) => p.id) },
    },
    select: { entityId: true },
  });
  const pendingConfirmationIds = new Set(pendingConfirmations.map((a) => a.entityId));

  // See lib/payment-status.ts — OVERDUE was only ever set once at seed time.
  return payments.map((p) => ({
    ...p,
    status: computeVendorPaymentStatus(p),
    awaitingConfirmation: pendingConfirmationIds.has(p.id),
  }));
}
