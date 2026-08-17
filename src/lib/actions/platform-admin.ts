"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/dal";

function addOneMonth(date: Date): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

// Approval is the sole activation path: payment status, subscription status,
// its billing period, module grants, and licence count all move together in
// one transaction — never partially applied (Phase 15's core requirement).
export async function approvePayment(paymentId: string) {
  const session = await requireSuperAdmin();

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, status: "PENDING" } });
    if (!payment) {
      throw new Error("Payment not found or already reviewed.");
    }

    // Validated before anything else changes, not just trusted from
    // submitPayment's own "modules non-empty" check — this function activates
    // whatever is actually stored on the Payment row, and that guarantee only
    // holds for rows created through today's version of submitPayment. An
    // older row, a manually-inserted one, or a future submission path could
    // all carry an empty modules array; activating a subscription with zero
    // modules produces a genuinely broken state (ACTIVE, but every
    // requireModuleAccess check fails — the org can log in and see nothing).
    const modules: string[] = JSON.parse(payment.modules);
    if (modules.length === 0) {
      throw new Error(
        "This payment has no modules on record — cannot activate a subscription with zero modules."
      );
    }

    const now = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "APPROVED", reviewedById: session.userId, reviewedAt: now },
    });

    const subscription = await tx.subscription.findUnique({ where: { id: payment.subscriptionId } });
    if (!subscription) {
      throw new Error("Subscription not found.");
    }

    // Renewing before expiry extends the existing period instead of
    // restarting it from today — avoids overlapping/duplicate billing periods.
    const periodStart =
      subscription.currentPeriodEnd && subscription.currentPeriodEnd > now
        ? subscription.currentPeriodEnd
        : now;
    const periodEnd = addOneMonth(periodStart);

    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        licencedUsers: payment.numUsers,
      },
    });

    await tx.subscriptionModule.deleteMany({ where: { subscriptionId: subscription.id } });
    await tx.subscriptionModule.createMany({
      data: modules.map((module) => ({ subscriptionId: subscription.id, module })),
    });
  });

  revalidatePath("/platform-admin");
}

export async function rejectPayment(paymentId: string, reason: string) {
  const session = await requireSuperAdmin();

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("A rejection reason is required.");
  }

  const result = await prisma.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: {
      status: "REJECTED",
      rejectionReason: trimmedReason,
      reviewedById: session.userId,
      reviewedAt: new Date(),
    },
  });
  if (result.count === 0) {
    throw new Error("Payment not found or already reviewed.");
  }

  revalidatePath("/platform-admin");
}
