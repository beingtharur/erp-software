import { prisma } from "@/lib/db";

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
  return prisma.vendor.findFirst({
    where: { id, organizationId },
    include: {
      purchaseOrders: { orderBy: { orderDate: "desc" } },
      payments: { orderBy: { dueDate: "desc" }, include: { purchaseOrder: true } },
    },
  });
}

export async function getVendorPayments(organizationId: string) {
  return prisma.vendorPayment.findMany({
    where: { vendor: { organizationId } },
    orderBy: { dueDate: "asc" },
    include: { vendor: true, purchaseOrder: true },
  });
}
