import { prisma } from "@/lib/db";
import { computeVendorPaymentStatus } from "@/lib/payment-status";
import type { PoStatus } from "@/generated/prisma/client";

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

export type VendorExportFilters = {
  status?: string;
  city?: string;
  category?: string;
  createdFrom?: Date;
  createdTo?: Date;
};

// No default date range, unlike Attendance/Leave — Vendor is master data
// (like Employee), not a recurring transactional log, so an unfiltered
// export should mean "every vendor," not "this month's vendors."
export async function getVendorsForExport(organizationId: string, filters: VendorExportFilters) {
  const createdAtFilter =
    filters.createdFrom || filters.createdTo
      ? {
          ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
          ...(filters.createdTo ? { lte: filters.createdTo } : {}),
        }
      : undefined;

  return prisma.vendor.findMany({
    where: {
      organizationId,
      status: filters.status || undefined,
      city: filters.city || undefined,
      category: filters.category || undefined,
      createdAt: createdAtFilter,
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { purchaseOrders: true, payments: true } },
    },
  });
}

export async function getVendorOptions(organizationId: string) {
  return prisma.vendor.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export type PurchaseOrderExportFilters = {
  status?: string;
  vendorId?: string;
  fromDate?: Date;
  toDate?: Date;
};

// No default date range — same reasoning as Vendor Export. A PO register is
// a financial record set; "unfiltered" should mean "every order," not "this
// month's orders."
export async function getPurchaseOrdersForExport(organizationId: string, filters: PurchaseOrderExportFilters) {
  const orderDateFilter =
    filters.fromDate || filters.toDate
      ? {
          ...(filters.fromDate ? { gte: filters.fromDate } : {}),
          ...(filters.toDate ? { lte: filters.toDate } : {}),
        }
      : undefined;

  return prisma.purchaseOrder.findMany({
    where: {
      vendor: { organizationId },
      status: filters.status ? (filters.status as PoStatus) : undefined,
      vendorId: filters.vendorId || undefined,
      orderDate: orderDateFilter,
    },
    orderBy: { orderDate: "desc" },
    include: { vendor: true },
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
