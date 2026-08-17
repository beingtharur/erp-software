"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { notifyRole } from "@/lib/notify";
import { requestApproval } from "@/lib/approvals";
import { formatINR } from "@/lib/format";
import { withUniqueCodeRetry } from "@/lib/sequence";
import { saveFile } from "@/lib/storage";
import type { FormActionState } from "@/lib/actions/crm";
import type { AccessRole } from "@/generated/prisma/client";

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024; // 10MB

export async function createExpenseClaim(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  if (!user.employeeId) {
    return { error: "No employee record linked to this account." };
  }

  const category = String(formData.get("category") ?? "");
  const amount = Number(formData.get("amount"));
  const expenseDate = String(formData.get("expenseDate") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const receipt = formData.get("receipt");

  if (!category || !expenseDate || !description) {
    return { error: "Please fill in all fields." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount." };
  }
  const parsedExpenseDate = new Date(expenseDate);
  if (Number.isNaN(parsedExpenseDate.getTime())) {
    return { error: "Enter a valid expense date." };
  }
  // The date input's `max` attribute stops this in the browser, but that's
  // trivially bypassed — enforce it server-side too.
  if (parsedExpenseDate.getTime() > Date.now()) {
    return { error: "Expense date can't be in the future." };
  }
  if (receipt instanceof File && receipt.size > MAX_RECEIPT_SIZE) {
    return { error: "Receipt file is too large (max 10MB)." };
  }

  // claimNumber is globally unique (not scoped per organization), so the
  // count driving it must be global too; retry on collision (see sequence.ts).
  const claim = await withUniqueCodeRetry(async () => {
    const count = await prisma.expenseClaim.count();
    const claimNumber = `EXP-${2001 + count}`;
    return prisma.expenseClaim.create({
      data: {
        claimNumber,
        employeeId: user.employeeId!,
        category: category as never,
        amount,
        expenseDate: new Date(expenseDate),
        description,
      },
    });
  });

  if (receipt instanceof File && receipt.size > 0) {
    const { url, storageKey } = await saveFile(receipt, `expense-claims/${organizationId}`);
    await prisma.expenseClaimAttachment.create({
      data: {
        expenseClaimId: claim.id,
        fileUrl: url,
        storageKey,
        fileName: receipt.name,
        fileSize: receipt.size,
      },
    });
  }

  // Which role's queue this routes to is configurable per organization (see
  // Organization.expenseApproverRole) — most orgs never set it and fall back
  // to FINANCE, but a small org that runs Finance duties through its Admin
  // (or HR) can point claims there instead so they don't route to a role
  // nobody in that org holds.
  const organization = await getCurrentOrganization();
  const approverRole: AccessRole = organization.expenseApproverRole ?? "FINANCE";

  await requestApproval({
    entityType: "EXPENSE_CLAIM",
    entityId: claim.id,
    requestedById: user.employeeId,
    approverRole,
    note: notes,
  });

  const message = `New expense claim ${claim.claimNumber} (${formatINR(amount)}) is awaiting your approval.`;
  await notifyRole(approverRole, organizationId, message, "/approvals");
  // HR always gets visibility into expense claims regardless of who's
  // configured as the decider (see getPendingApprovals) — notify them too,
  // unless they *are* the configured approver (would just double the message).
  if (approverRole !== "HR") {
    await notifyRole("HR", organizationId, message, "/approvals");
  }

  revalidatePath("/me");
  revalidatePath("/finance");
  revalidatePath("/approvals");
  revalidatePath("/hrms");
  return { success: true };
}

// Admin-only: which role's approval queue new expense claims route to for
// this organization. Null clears the override back to the system default
// (FINANCE). See the schema comment on Organization.expenseApproverRole.
export async function updateExpenseApproverRole(role: AccessRole | "DEFAULT") {
  await requireRole(["ADMIN"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  await prisma.organization.update({
    where: { id: organizationId },
    data: { expenseApproverRole: role === "DEFAULT" ? null : role },
  });

  revalidatePath("/finance");
}

export async function markExpenseClaimReimbursed(claimId: string) {
  await requireRole(["ADMIN", "FINANCE"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const claim = await prisma.expenseClaim.findFirst({
    where: { id: claimId, employee: { organizationId } },
  });
  if (!claim || claim.status !== "APPROVED") {
    throw new Error("Only approved claims can be marked reimbursed");
  }
  await prisma.expenseClaim.update({
    where: { id: claimId },
    data: { status: "REIMBURSED", reimbursedOn: new Date() },
  });
  revalidatePath("/finance");
  revalidatePath("/me");
}

export async function createBudget(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "FINANCE"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  if (!user.employeeId) {
    return { error: "No employee record linked to this account." };
  }

  const departmentId = String(formData.get("departmentId") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const proposedAmount = Number(formData.get("proposedAmount"));

  if (!departmentId || !category || !startDate || !endDate) {
    return { error: "Please fill in all fields." };
  }

  // Scoped to the caller's organization — a budget must not be openable against
  // another tenant's department.
  const department = await prisma.department.findFirst({
    where: { id: departmentId, organizationId },
    select: { id: true, name: true },
  });
  if (!department) {
    return { error: "Department not found." };
  }
  if (!Number.isFinite(proposedAmount) || proposedAmount <= 0) {
    return { error: "Enter a valid amount." };
  }
  if (new Date(endDate) < new Date(startDate)) {
    return { error: "End date must be after start date." };
  }

  const budget = await prisma.budget.create({
    data: {
      departmentId: department.id,
      category: category as never,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      proposedAmount,
      requestedById: user.employeeId,
    },
  });

  await requestApproval({
    entityType: "BUDGET",
    entityId: budget.id,
    requestedById: user.employeeId,
    approverRole: "ADMIN",
  });

  await notifyRole(
    "ADMIN",
    organizationId,
    `New budget proposal for ${department.name} (${formatINR(proposedAmount)}) is awaiting your approval.`,
    "/approvals"
  );

  revalidatePath("/finance/budgets");
  return { success: true };
}
