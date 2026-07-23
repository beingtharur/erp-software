"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { notifyEmployee } from "@/lib/notify";
import { titleCase } from "@/lib/format";
import { calculateNetPay } from "@/lib/payroll";
import { saveFile, deleteFile } from "@/lib/storage";
import type { FormActionState } from "@/lib/actions/crm";

export async function decideLeaveRequest(
  leaveId: string,
  decision: "APPROVED" | "REJECTED"
) {
  await requireRole(["ADMIN", "HR"]);
  const user = await getCurrentUser();
  const leave = await prisma.leaveRequest.update({
    where: { id: leaveId },
    data: { status: decision, decidedOn: new Date(), decidedBy: user.employee?.name ?? "HR" },
  });
  await notifyEmployee(
    leave.employeeId,
    `Your ${titleCase(leave.type)} leave request was ${decision === "APPROVED" ? "approved" : "rejected"}.`,
    "/me"
  );
  revalidatePath("/hrms");
  revalidatePath("/hrms/leave");
  revalidatePath("/");
}

export async function processPayroll(payrollId: string) {
  await requireRole(["ADMIN", "HR"]);

  const record = await prisma.payrollRecord.findUnique({ where: { id: payrollId } });
  if (!record) {
    throw new Error("Payroll record not found");
  }

  // Pull any unpaid leave actually taken in this pay period and deduct it for real,
  // instead of trusting the flat deduction the record was seeded with.
  const periodStart = new Date(record.year, record.month - 1, 1);
  const periodEnd = new Date(record.year, record.month, 0, 23, 59, 59, 999);
  const unpaidLeave = await prisma.leaveRequest.findMany({
    where: {
      employeeId: record.employeeId,
      type: "UNPAID",
      status: "APPROVED",
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
    },
  });
  const unpaidLeaveDays = unpaidLeave.reduce((sum, l) => sum + l.days, 0);

  const { deductions, netPay } = calculateNetPay({
    basicSalary: record.basicSalary,
    allowances: record.allowances,
    baseDeductions: record.deductions,
    unpaidLeaveDays,
  });

  await prisma.payrollRecord.update({
    where: { id: payrollId },
    data: { status: "PROCESSED", paidOn: new Date(), deductions, netPay },
  });
  revalidatePath("/hrms/payroll");
  revalidatePath("/hrms");
}

export async function createEmployee(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "HR"]);

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const department = String(formData.get("department") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const dateOfJoining = String(formData.get("dateOfJoining") ?? "");
  const baseLocation = String(formData.get("baseLocation") ?? "").trim();

  if (!name || !role || !department || !email || !phone || !dateOfJoining || !baseLocation) {
    return { error: "Please fill in all fields." };
  }

  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) {
    return { error: "An employee with this email already exists." };
  }

  const count = await prisma.employee.count();
  const employeeCode = `EOS-${String(count + 1).padStart(3, "0")}`;

  await prisma.employee.create({
    data: {
      employeeCode,
      name,
      role: role as never,
      department,
      email,
      phone,
      dateOfJoining: new Date(dateOfJoining),
      baseLocation,
      avatarSeed: employeeCode,
    },
  });

  revalidatePath("/hrms/employees");
  revalidatePath("/hrms");
  return { success: true };
}

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadEmployeeDocument(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "HR"]);
  const uploader = await getCurrentUser();
  if (!uploader.employeeId) {
    return { error: "No employee record linked to this account." };
  }

  const employeeId = String(formData.get("employeeId") ?? "");
  const type = String(formData.get("type") ?? "");
  const file = formData.get("file");

  if (!employeeId || !type || !(file instanceof File) || file.size === 0) {
    return { error: "Please choose a document type and a file." };
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return { error: "File is too large (max 10MB)." };
  }

  const { url, storageKey } = await saveFile(file, `employees/${employeeId}`);

  await prisma.employeeDocument.create({
    data: {
      employeeId,
      type: type as never,
      fileName: file.name,
      fileUrl: url,
      storageKey,
      fileSize: file.size,
      uploadedById: uploader.employeeId,
    },
  });

  revalidatePath(`/hrms/employees/${employeeId}`);
  return { success: true };
}

export async function deleteEmployeeDocument(documentId: string) {
  await requireRole(["ADMIN", "HR"]);
  const doc = await prisma.employeeDocument.delete({ where: { id: documentId } });
  await deleteFile(doc.storageKey);
  revalidatePath(`/hrms/employees/${doc.employeeId}`);
}
