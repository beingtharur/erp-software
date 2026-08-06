"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { notifyRole } from "@/lib/notify";
import { requestApproval } from "@/lib/approvals";
import { formatINR } from "@/lib/format";
import { withUniqueCodeRetry } from "@/lib/sequence";
import type { FormActionState } from "@/lib/actions/crm";

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

  await requestApproval({
    entityType: "EXPENSE_CLAIM",
    entityId: claim.id,
    requestedById: user.employeeId,
    approverRole: "FINANCE",
  });

  await notifyRole(
    "FINANCE",
    organizationId,
    `New expense claim ${claim.claimNumber} (${formatINR(amount)}) is awaiting your approval.`,
    "/approvals"
  );

  revalidatePath("/me");
  revalidatePath("/finance");
  return { success: true };
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
