"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { notifyRole } from "@/lib/notify";
import { formatINR } from "@/lib/format";
import { requestApproval } from "@/lib/approvals";
import { withUniqueCodeRetry } from "@/lib/sequence";
import { saveFile } from "@/lib/storage";
import { PO_STATUS_TRANSITIONS, isValidTransition, type PoStatus } from "@/lib/status-transitions";
import type { FormActionState } from "@/lib/actions/crm";

const MAX_PROOF_SIZE = 10 * 1024 * 1024; // 10MB

// Replaces the old markPaymentPaid, which flipped a VendorPayment straight to
// PAID from a single click — no reference, no proof, no check that the
// confirmer differed from whoever created the PO. This submits evidence and
// routes through the generic Approval Engine (decideApproval's
// PAYMENT_CONFIRMATION case) instead of writing PAID directly, so a second
// admin — never the requester themselves, enforced in decideApproval — has to
// review it. Mirrors the existing subscription-payment flow (submitPayment ->
// platform-admin review) rather than inventing a separate mechanism.
export async function requestPaymentConfirmation(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const requester = await getCurrentUser();
  const organizationId = requester.organizationId!;
  if (!requester.employeeId) {
    return { error: "No employee record linked to this account." };
  }

  const paymentId = String(formData.get("paymentId") ?? "");
  const referenceNumber = String(formData.get("referenceNumber") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const proof = formData.get("proof");

  if (!paymentId || !referenceNumber) {
    return { error: "Enter the payment reference / UTR number." };
  }

  const payment = await prisma.vendorPayment.findFirst({
    where: { id: paymentId, vendor: { organizationId } },
  });
  if (!payment) {
    return { error: "Payment not found." };
  }
  if (payment.status !== "PENDING") {
    return { error: "Only pending payments can be submitted for confirmation." };
  }

  const alreadyRequested = await prisma.approvalRequest.findFirst({
    where: { entityType: "PAYMENT_CONFIRMATION", entityId: paymentId, status: "PENDING" },
  });
  if (alreadyRequested) {
    return { error: "This payment is already awaiting confirmation." };
  }

  let proofUrl: string | undefined;
  let proofKey: string | undefined;
  if (proof instanceof File && proof.size > 0) {
    if (proof.size > MAX_PROOF_SIZE) {
      return { error: "Proof file is too large (max 10MB)." };
    }
    const { url, storageKey } = await saveFile(proof, `vendor-payments/${organizationId}`);
    proofUrl = url;
    proofKey = storageKey;
  }

  await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { referenceNumber, proofUrl, proofKey, method: "NEFT" },
  });

  await requestApproval({
    entityType: "PAYMENT_CONFIRMATION",
    entityId: paymentId,
    requestedById: requester.employeeId,
    approverRole: "ADMIN",
    note: notes,
  });

  await notifyRole(
    "ADMIN",
    organizationId,
    `Payment of ${formatINR(payment.amount)} (ref ${referenceNumber}) is awaiting confirmation.`,
    "/approvals"
  );

  revalidatePath("/vendors/payments");
  revalidatePath("/approvals");
  return { success: true };
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
      // Previously hardcoded to 4.0 with no basis — a brand-new vendor hasn't
      // been rated yet. 0 displays as unrated (all stars empty); the first
      // real rating is set via VendorRatingControl on the detail page.
      rating: 0,
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
  if (!requester.employeeId) {
    return { error: "No employee record linked to this account." };
  }

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
  // driving it must be global too; retry on collision (see sequence.ts).
  const po = await withUniqueCodeRetry(async () => {
    const latest = await prisma.purchaseOrder.findFirst({
      orderBy: {
        poNumber: "desc",
      },
    });

    const lastNumber = latest
      ? parseInt(latest.poNumber.replace("PO-", ""), 10)
      : 7000;

    const poNumber = `PO-${lastNumber + 1}`;
    return prisma.purchaseOrder.create({
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
  });

  await requestApproval({
    entityType: "PURCHASE_ORDER",
    entityId: po.id,
    requestedById: requester.employeeId,
    approverRole: "ADMIN",
  });

  await notifyRole(
    "ADMIN",
    organizationId,
    `New purchase order ${po.poNumber} for ${vendor.name} (${formatINR(amount)}) is awaiting your approval.`,
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

  // The edit form's status field is currently always resubmitted unchanged
  // (there's no status picker in the UI), but validate it defensively anyway —
  // this is the only thing standing between a crafted request and an illegal
  // jump like DRAFT -> DELIVERED.
  if (
    status !== existing.status &&
    !isValidTransition(PO_STATUS_TRANSITIONS, existing.status as PoStatus, status as PoStatus)
  ) {
    return { error: `Can't move a purchase order from ${existing.status} directly to ${status}.` };
  }

  // Financial immutability: once a PO has left DRAFT (i.e. it's been through
  // approval and turned into a real commitment — decideApproval already
  // created a VendorPayment for it), the commercial terms are locked. Editing
  // vendor/items/amount/dates after that point would silently change what was
  // actually approved and paid against. Cancel + recreate is the correct path
  // for a genuine mistake, matching how the rest of the app already handles
  // corrections (e.g. expense claims: reject and resubmit, not edit-in-place).
  if (existing.status !== "DRAFT") {
    const unchanged =
      vendorId === existing.vendorId &&
      itemsDescription === existing.itemsDescription &&
      amount === existing.amount &&
      new Date(orderDate).getTime() === existing.orderDate.getTime() &&
      new Date(expectedDelivery).getTime() === existing.expectedDelivery.getTime();
    if (!unchanged) {
      return {
        error: "Vendor, items, amount, and dates can't be changed once a purchase order has left Draft. Cancel it and create a new one instead.",
      };
    }
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

// The only way to change a PO's commercial terms after DRAFT is to cancel it
// (see the immutability guard in updatePurchaseOrder above) — this is that
// escape hatch. Reuses the existing PO_STATUS_TRANSITIONS state machine
// (SENT/CONFIRMED -> CANCELLED are already legal transitions there) rather
// than adding a parallel one.
export async function cancelPurchaseOrder(poId: string) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const existing = await prisma.purchaseOrder.findFirst({
    where: { id: poId, vendor: { organizationId } },
  });
  if (!existing) {
    throw new Error("Purchase order not found");
  }
  if (!isValidTransition(PO_STATUS_TRANSITIONS, existing.status as PoStatus, "CANCELLED")) {
    throw new Error(`Can't cancel a purchase order that's already ${existing.status}.`);
  }

  const result = await prisma.purchaseOrder.updateMany({
    where: { id: poId, status: existing.status },
    data: { status: "CANCELLED" },
  });
  if (result.count === 0) {
    throw new Error("Purchase order status changed — refresh and try again.");
  }

  revalidatePath("/vendors/purchase-orders");
  revalidatePath(`/vendors/${existing.vendorId}`);
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
  if (!user.employeeId) {
    throw new Error("No employee record linked to this account.");
  }

  const source = await prisma.purchaseOrder.findFirst({
    where: { id: poId, vendor: { organizationId } },
    include: { vendor: true },
  });
  if (!source) {
    throw new Error("Purchase order not found");
  }

  const orderDate = new Date();
  const leadTimeMs = source.expectedDelivery.getTime() - source.orderDate.getTime();
  const expectedDelivery = new Date(orderDate.getTime() + Math.max(leadTimeMs, 0));

  // poNumber is globally unique (not scoped per organization), so the count
  // driving it must be global too — see the identical comment in
  // createPurchaseOrder; retry on collision (see sequence.ts).
  const po = await withUniqueCodeRetry(async () => {
    const latest = await prisma.purchaseOrder.findFirst({
      orderBy: {
        poNumber: "desc",
      },
    });

    const lastNumber = latest
      ? parseInt(latest.poNumber.replace("PO-", ""), 10)
      : 7000;

    const poNumber = `PO-${lastNumber + 1}`;
    return prisma.purchaseOrder.create({
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
  });

  await requestApproval({
    entityType: "PURCHASE_ORDER",
    entityId: po.id,
    requestedById: user.employeeId,
    approverRole: "ADMIN",
  });

  await notifyRole(
    "ADMIN",
    organizationId,
    `Reordered purchase order ${po.poNumber} for ${source.vendor.name} (${formatINR(source.amount)}) is awaiting your approval.`,
    "/approvals"
  );

  revalidatePath("/vendors/purchase-orders");
  revalidatePath("/approvals");
}
