"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { notifyEmployee } from "@/lib/notify";
import { formatINR } from "@/lib/format";

export async function decideApproval(approvalId: string, decision: "APPROVED" | "REJECTED") {
  const decider = await getCurrentUser();
  const organizationId = decider.organizationId!;

  const approval = await prisma.approvalRequest.findFirst({
    where: { id: approvalId, requestedBy: { organizationId } },
  });
  if (!approval) {
    throw new Error("Approval request not found");
  }
  if (approval.status !== "PENDING") {
    throw new Error("This request has already been decided");
  }

  // The engine is generic: who's allowed to decide is data-driven off the request
  // itself, not hardcoded per entity type. The organizationId filter above is what
  // actually stops a same-role user in a different org from deciding this request.
  await requireRole([approval.approverRole]);

  await prisma.approvalRequest.update({
    where: { id: approvalId },
    data: { status: decision, decidedById: decider.employeeId, decidedOn: new Date() },
  });

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
  }

  revalidatePath("/approvals");
}
