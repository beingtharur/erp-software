"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { notifyRole } from "@/lib/notify";
import { formatINR } from "@/lib/format";
import { requestApproval } from "@/lib/approvals";
import type { FormActionState } from "@/lib/actions/crm";

export async function markPaymentPaid(paymentId: string, method: string) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const existing = await prisma.vendorPayment.findFirst({
    where: { id: paymentId, vendor: { organizationId } },
  });
  if (!existing) {
    throw new Error("Payment not found");
  }

  const payment = await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidDate: new Date(), method },
    include: { vendor: true },
  });
  await notifyRole(
    "ADMIN",
    organizationId,
    `Payment of ${formatINR(payment.amount)} marked paid to ${payment.vendor.name}.`,
    "/vendors/payments"
  );
  revalidatePath("/vendors/payments");
  revalidatePath("/");
}

export async function updateVendorRating(vendorId: string, rating: number) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const result = await prisma.vendor.updateMany({
    where: { id: vendorId, organizationId },
    data: { rating },
  });
  if (result.count === 0) {
    throw new Error("Vendor not found");
  }
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/vendors");
}

export async function createVendor(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim().toLowerCase();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();

  if (!name || !category || !contactName || !contactEmail || !contactPhone || !city) {
    return { error: "Please fill in all fields." };
  }

  await prisma.vendor.create({
    data: {
      name,
      category,
      contactName,
      contactEmail,
      contactPhone,
      city,
      rating: 4.0,
      status: "Active",
      organizationId,
    },
  });

  revalidatePath("/vendors");
  return { success: true };
}

export async function deleteVendor(vendorId: string) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, organizationId },
    include: { _count: { select: { purchaseOrders: true, payments: true } } },
  });
  if (!vendor) {
    throw new Error("Vendor not found");
  }
  if (vendor._count.purchaseOrders > 0 || vendor._count.payments > 0) {
    throw new Error("Cannot delete a vendor with existing purchase orders or payments.");
  }

  await prisma.vendor.delete({ where: { id: vendorId } });
  revalidatePath("/vendors");
}

export async function createPurchaseOrder(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const requester = await getCurrentUser();
  const organizationId = requester.organizationId!;

  const vendorId = String(formData.get("vendorId") ?? "");
  const itemsDescription = String(formData.get("itemsDescription") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const orderDate = String(formData.get("orderDate") ?? "");
  const expectedDelivery = String(formData.get("expectedDelivery") ?? "");

  if (!vendorId || !itemsDescription || !orderDate || !expectedDelivery) {
    return { error: "Please fill in all fields." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount." };
  }

  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, organizationId } });
  if (!vendor) {
    return { error: "Vendor not found." };
  }

  // poNumber is globally unique (not scoped per organization), so the count
  // driving it must be global too.
  const count = await prisma.purchaseOrder.count();
  const poNumber = `PO-${7000 + count + 1}`;

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      vendorId,
      itemsDescription,
      amount,
      orderDate: new Date(orderDate),
      expectedDelivery: new Date(expectedDelivery),
      status: "DRAFT",
    },
  });

  if (requester.employeeId) {
    await requestApproval({
      entityType: "PURCHASE_ORDER",
      entityId: po.id,
      requestedById: requester.employeeId,
      approverRole: "ADMIN",
    });
  }

  await notifyRole(
    "ADMIN",
    organizationId,
    `New purchase order ${poNumber} for ${vendor.name} (${formatINR(amount)}) is awaiting your approval.`,
    "/approvals"
  );

  revalidatePath("/vendors/purchase-orders");
  revalidatePath("/approvals");
  return { success: true };
}

export async function updatePurchaseOrder(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const poId = String(formData.get("poId") ?? "");
  const vendorId = String(formData.get("vendorId") ?? "");
  const itemsDescription = String(formData.get("itemsDescription") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const orderDate = String(formData.get("orderDate") ?? "");
  const expectedDelivery = String(formData.get("expectedDelivery") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!poId || !vendorId || !itemsDescription || !orderDate || !expectedDelivery || !status) {
    return { error: "Please fill in all fields." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount." };
  }

  const existing = await prisma.purchaseOrder.findFirst({
    where: { id: poId, vendor: { organizationId } },
  });
  if (!existing) {
    return { error: "Purchase order not found." };
  }
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, organizationId } });
  if (!vendor) {
    return { error: "Vendor not found." };
  }

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      vendorId,
      itemsDescription,
      amount,
      orderDate: new Date(orderDate),
      expectedDelivery: new Date(expectedDelivery),
      status: status as never,
    },
  });

  revalidatePath("/vendors/purchase-orders");
  revalidatePath(`/vendors/${vendorId}`);
  return { success: true };
}

export async function deletePurchaseOrder(poId: string) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, vendor: { organizationId } },
    include: { _count: { select: { payments: true } } },
  });
  if (!po) {
    throw new Error("Purchase order not found");
  }
  if (po._count.payments > 0) {
    throw new Error("Cannot delete a purchase order with recorded payments.");
  }

  await prisma.$transaction([
    prisma.approvalRequest.deleteMany({ where: { entityType: "PURCHASE_ORDER", entityId: poId } }),
    prisma.purchaseOrder.delete({ where: { id: poId } }),
  ]);

  revalidatePath("/vendors/purchase-orders");
  revalidatePath("/approvals");
}

// "Reorder" — clone a previous PO into a fresh DRAFT against the same vendor
// and items, preserving the original's order-to-delivery lead time applied
// from today, rather than making the requester re-key everything.
export async function duplicatePurchaseOrder(poId: string) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const source = await prisma.purchaseOrder.findFirst({
    where: { id: poId, vendor: { organizationId } },
    include: { vendor: true },
  });
  if (!source) {
    throw new Error("Purchase order not found");
  }

  // poNumber is globally unique (not scoped per organization), so the count
  // driving it must be global too — see the identical comment in createPurchaseOrder.
  const count = await prisma.purchaseOrder.count();
  const poNumber = `PO-${7000 + count + 1}`;
  const orderDate = new Date();
  const leadTimeMs = source.expectedDelivery.getTime() - source.orderDate.getTime();
  const expectedDelivery = new Date(orderDate.getTime() + Math.max(leadTimeMs, 0));

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      vendorId: source.vendorId,
      itemsDescription: source.itemsDescription,
      amount: source.amount,
      orderDate,
      expectedDelivery,
      status: "DRAFT",
    },
  });

  if (user.employeeId) {
    await requestApproval({
      entityType: "PURCHASE_ORDER",
      entityId: po.id,
      requestedById: user.employeeId,
      approverRole: "ADMIN",
    });
  }

  await notifyRole(
    "ADMIN",
    organizationId,
    `Reordered purchase order ${poNumber} for ${source.vendor.name} (${formatINR(source.amount)}) is awaiting your approval.`,
    "/approvals"
  );

  revalidatePath("/vendors/purchase-orders");
  revalidatePath("/approvals");
}
