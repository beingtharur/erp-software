"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { saveFile } from "@/lib/storage";
import { calculatePrice, PRICING_CONFIG } from "@/lib/billing/pricing-config";
import { isModuleKey } from "@/lib/billing/access";
import type { FormActionState } from "@/lib/actions/crm";
import type { PaymentMethod } from "@/generated/prisma/client";

const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024; // 10MB

export async function submitPayment(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const numUsers = Number(formData.get("numUsers"));
  const modules = formData.getAll("modules").map(String).filter(isModuleKey);
  const method = String(formData.get("method") ?? "");
  const utr = String(formData.get("utr") ?? "").trim();
  const paymentDateRaw = String(formData.get("paymentDate") ?? "");
  const payerUpiId = String(formData.get("payerUpiId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const screenshot = formData.get("screenshot");

  if (!Number.isFinite(numUsers) || numUsers < PRICING_CONFIG.minimumUsers) {
    return { error: `Minimum purchase is ${PRICING_CONFIG.minimumUsers} users.` };
  }
  if (modules.length === 0) {
    return { error: "Select at least one module." };
  }
  if (method !== "UPI" && method !== "BANK_TRANSFER") {
    return { error: "Select a payment method." };
  }
  if (!utr) {
    return { error: "Enter the UTR / transaction ID." };
  }
  const paymentDate = new Date(paymentDateRaw);
  if (Number.isNaN(paymentDate.getTime())) {
    return { error: "Enter a valid payment date." };
  }

  let screenshotUrl: string | undefined;
  if (screenshot instanceof File && screenshot.size > 0) {
    if (screenshot.size > MAX_SCREENSHOT_SIZE) {
      return { error: "Screenshot is too large (max 10MB)." };
    }
    const { url } = await saveFile(screenshot, `payments/${organizationId}`);
    screenshotUrl = url;
  }

  // Amount is always recomputed here from the pricing engine — never trusted
  // from a client-supplied value. The admin verifies this against what they
  // actually received before approving (see platform-admin verification).
  const price = calculatePrice(numUsers, modules);

  const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
  if (!subscription) {
    return { error: "No subscription found for your organization." };
  }

  try {
    await prisma.payment.create({
      data: {
        organizationId,
        subscriptionId: subscription.id,
        submittedById: user.id,
        numUsers,
        modules: JSON.stringify(modules),
        amount: price.finalPrice,
        method: method as PaymentMethod,
        utr,
        payerUpiId,
        screenshotUrl,
        notes,
        paymentDate,
      },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return { error: "This UTR has already been submitted. Duplicate payments aren't allowed." };
    }
    throw err;
  }

  revalidatePath("/subscription");
  return { success: true };
}
