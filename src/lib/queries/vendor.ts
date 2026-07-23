import { prisma } from "@/lib/db";

export async function getVendors() {
  return prisma.vendor.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { purchaseOrders: true, payments: true } },
    },
  });
}

export async function getPurchaseOrders() {
  return prisma.purchaseOrder.findMany({
    orderBy: { orderDate: "desc" },
    include: { vendor: true },
  });
}

export async function getVendorOptions() {
  return prisma.vendor.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getVendorDetail(id: string) {
  return prisma.vendor.findUnique({
    where: { id },
    include: {
      purchaseOrders: { orderBy: { orderDate: "desc" } },
      payments: { orderBy: { dueDate: "desc" }, include: { purchaseOrder: true } },
    },
  });
}

export async function getVendorPayments() {
  return prisma.vendorPayment.findMany({
    orderBy: { dueDate: "asc" },
    include: { vendor: true, purchaseOrder: true },
  });
}
