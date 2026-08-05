"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { notifyEmployee } from "@/lib/notify";
import { formatINR } from "@/lib/format";
import { logAudit } from "@/lib/audit";

export async function decideApproval(approvalId: string, decision: "APPROVED" | "REJECTED") {
  const decider = await getCurrentUser();
  const organizationId = decider.organizationId!;

  const approval = await prisma.approvalRequest.findFirst({
    where: { id: approvalId, requestedBy: { organizationId } },
  });
  if (!approval) {
    throw new Error("Approval request not found");
  }

  // The engine is generic: who's allowed to decide is data-driven off the request
  // itself, not hardcoded per entity type. The organizationId filter above is what
  // actually stops a same-role user in a different org from deciding this request.
  await requireRole([approval.approverRole]);

  // Maker-checker: for payment confirmations specifically, the person deciding
  // must differ from whoever submitted it — otherwise the same procurement/admin
  // user could both mark a payment "made" and confirm it themselves, which is
  // exactly the unvalidated-payment problem this entity type exists to close.
  // Scoped to this entity type only — PO/Budget/Expense approvals keep their
  // existing behavior (a single ADMIN can already both create and approve a PO
  // today, which is a separate, pre-existing, un-reported design choice).
  if (approval.entityType === "PAYMENT_CONFIRMATION" && approval.requestedById === decider.employeeId) {
    throw new Error("You can't confirm a payment you submitted yourself — ask another admin to review it.");
  }

  // Guard the PENDING -> decided transition with a status-scoped updateMany
  // instead of a plain read-then-write — two concurrent decisions (e.g. an
  // admin double-clicking Approve, or two admins deciding at once) would
  // otherwise both pass the check above and double-apply the entity-specific
  // side effects below (e.g. two VendorPayment rows for one PO). Same pattern
  // as platform-admin.ts::rejectPayment.
  const decided = await prisma.approvalRequest.updateMany({
    where: { id: approvalId, status: "PENDING" },
    data: { status: decision, decidedById: decider.employeeId, decidedOn: new Date() },
  });
  if (decided.count === 0) {
    throw new Error("This request has already been decided");
  }

  // Entity-specific side effects live here — this switch is the extension point for
  // future consumers (e.g. Finance expense claims) alongside ApprovalEntityType.
  switch (approval.entityType) {
    case "PURCHASE_ORDER": {
      const po = await prisma.purchaseOrder.update({
        where: { id: approval.entityId },
        data: { status: decision === "APPROVED" ? "SENT" : "CANCELLED" },
        include: { vendor: true },
      });
      if (decision === "APPROVED") {
        // Approving a PO is what turns it into an actual payable — this is the
        // only place a VendorPayment gets created for a purchase order.
        await prisma.vendorPayment.create({
          data: {
            vendorId: po.vendorId,
            purchaseOrderId: po.id,
            amount: po.amount,
            dueDate: po.expectedDelivery,
            status: "PENDING",
          },
        });
        revalidatePath("/vendors/payments");
      }
      await notifyEmployee(
        approval.requestedById,
        `Purchase order ${po.poNumber} for ${po.vendor.name} was ${decision === "APPROVED" ? "approved" : "rejected"}.`,
        "/vendors/purchase-orders"
      );
      revalidatePath("/vendors/purchase-orders");
      revalidatePath("/vendors");
      break;
    }
    case "EXPENSE_CLAIM": {
      const claim = await prisma.expenseClaim.update({
        where: { id: approval.entityId },
        data: { status: decision },
      });
      await notifyEmployee(
        approval.requestedById,
        `Your expense claim ${claim.claimNumber} (${formatINR(claim.amount)}) was ${decision === "APPROVED" ? "approved" : "rejected"}.`,
        "/me"
      );
      revalidatePath("/finance");
      revalidatePath("/me");
      break;
    }
    case "BUDGET": {
      const budget = await prisma.budget.update({
        where: { id: approval.entityId },
        data: { status: decision },
      });
      await notifyEmployee(
        approval.requestedById,
        `Your budget proposal for ${budget.department} (${formatINR(budget.proposedAmount)}) was ${decision === "APPROVED" ? "approved" : "rejected"}.`,
        "/finance/budgets"
      );
      revalidatePath("/finance/budgets");
      revalidatePath("/finance");
      break;
    }
    case "PAYMENT_CONFIRMATION": {
      // Reject leaves the VendorPayment PENDING with its submitted evidence
      // (reference/proof) intact — the requester can resubmit rather than
      // losing what they already uploaded. Approve is the only path that ever
      // flips a VendorPayment to PAID (see requestPaymentConfirmation, which
      // never sets status itself).
      const payment = await prisma.vendorPayment.update({
        where: { id: approval.entityId },
        data:
          decision === "APPROVED"
            ? { status: "PAID", paidDate: new Date(), confirmedById: decider.employeeId, confirmedAt: new Date() }
            : {},
        include: { vendor: true },
      });
      await notifyEmployee(
        approval.requestedById,
        `Payment of ${formatINR(payment.amount)} to ${payment.vendor.name} was ${decision === "APPROVED" ? "confirmed" : "not confirmed — please review and resubmit"}.`,
        "/vendors/payments"
      );
      revalidatePath("/vendors/payments");
      revalidatePath("/");
      break;
    }
  }

  await logAudit({
    organizationId,
    actorId: decider.id,
    action: decision === "APPROVED" ? "approval.approved" : "approval.rejected",
    entityType: approval.entityType,
    entityId: approval.entityId,
    metadata: { approvalId: approval.id },
  });

  revalidatePath("/approvals");
}
