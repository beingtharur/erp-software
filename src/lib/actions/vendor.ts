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
  const payment = await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidDate: new Date(), method },
    include: { vendor: true },
  });
  await notifyRole(
    "ADMIN",
    `Payment of ${formatINR(payment.amount)} marked paid to ${payment.vendor.name}.`,
    "/vendors/payments"
  );
  revalidatePath("/vendors/payments");
  revalidatePath("/");
}

export async function updateVendorRating(vendorId: string, rating: number) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }
  await prisma.vendor.update({ where: { id: vendorId }, data: { rating } });
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/vendors");
}

export async function createVendor(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "PROCUREMENT"]);

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
    },
  });

  revalidatePath("/vendors");
  return { success: true };
}

export async function createPurchaseOrder(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "PROCUREMENT"]);

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

  const count = await prisma.purchaseOrder.count();
  const poNumber = `PO-${7000 + count + 1}`;

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

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

  const requester = await getCurrentUser();
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
    `New purchase order ${poNumber} for ${vendor?.name ?? "a vendor"} (${formatINR(amount)}) is awaiting your approval.`,
    "/approvals"
  );

  revalidatePath("/vendors/purchase-orders");
  revalidatePath("/approvals");
  return { success: true };
}
