"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { notifyEmployee, notifyUser } from "@/lib/notify";
import { titleCase } from "@/lib/format";
import { calculateNetPay, calculateSalaryComponents } from "@/lib/payroll";
import { saveFile, deleteFile } from "@/lib/storage";
import { hashPassword } from "@/lib/password";
import { roleSectionAccess } from "@/lib/nav";
import type { FormActionState } from "@/lib/actions/crm";
import type { AccessRole } from "@/generated/prisma/client";

const DEFAULT_TEMP_PASSWORD = "demo123";

class LicenceLimitError extends Error {
  constructor(public licencedUsers: number) {
    super("Licence limit reached");
  }
}

export async function decideLeaveRequest(
  leaveId: string,
  decision: "APPROVED" | "REJECTED"
) {
  await requireRole(["ADMIN", "HR"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const existing = await prisma.leaveRequest.findFirst({
    where: { id: leaveId, employee: { organizationId } },
  });
  if (!existing) {
    throw new Error("Leave request not found");
  }

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
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const record = await prisma.payrollRecord.findFirst({
    where: { id: payrollId, employee: { organizationId } },
  });
  if (!record) {
    throw new Error("Payroll record not found");
  }
  if (record.status === "PROCESSED") {
    throw new Error("Payroll is already processed and locked. Unlock it first to reprocess.");
  }

  // Pull any unpaid leave actually taken in this pay period and deduct it for real,
  // instead of trusting the flat deduction the record was seeded with. baseDeductions
  // here is whatever statutory total (PF/ESI/tax) generatePayroll already computed
  // from the salary structure — this just adds the leave-based portion on top.
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
    bonus: record.bonus,
    overtimePay: record.overtimePay,
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

export async function unlockPayroll(payrollId: string) {
  await requireRole(["ADMIN"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const result = await prisma.payrollRecord.updateMany({
    where: { id: payrollId, employee: { organizationId }, status: "PROCESSED" },
    data: { status: "PENDING", paidOn: null },
  });
  if (result.count === 0) {
    throw new Error("Payroll record not found or not currently locked.");
  }
  revalidatePath("/hrms/payroll");
  revalidatePath("/hrms");
}

export async function generatePayroll(month: number, year: number) {
  await requireRole(["ADMIN", "HR"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    throw new Error("Invalid month or year.");
  }

  const employees = await prisma.employee.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { id: true },
  });

  let created = 0;
  let skippedExisting = 0;
  let skippedNoSalaryStructure = 0;

  for (const emp of employees) {
    const existing = await prisma.payrollRecord.findUnique({
      where: { employeeId_month_year: { employeeId: emp.id, month, year } },
    });
    if (existing) {
      skippedExisting++;
      continue;
    }

    // Payroll is always driven by the employee's active salary structure — never
    // by copying a prior payroll record — so a brand-new employee with zero
    // payroll history still generates normally as long as HR has set one up.
    const structure = await prisma.salaryStructure.findFirst({
      where: { employeeId: emp.id, isActive: true },
    });
    if (!structure) {
      skippedNoSalaryStructure++;
      continue;
    }

    const { allowances, statutoryDeductions } = calculateSalaryComponents(structure);
    const netPay = structure.basicSalary + allowances + structure.bonus - statutoryDeductions;

    await prisma.payrollRecord.create({
      data: {
        employeeId: emp.id,
        month,
        year,
        basicSalary: structure.basicSalary,
        allowances,
        bonus: structure.bonus,
        overtimePay: 0,
        deductions: statutoryDeductions,
        netPay,
        status: "PENDING",
        salaryStructureId: structure.id,
      },
    });
    created++;
  }

  revalidatePath("/hrms/payroll");
  revalidatePath("/hrms");
  return { created, skippedExisting, skippedNoSalaryStructure };
}

export async function createSalaryStructure(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "HR"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const employeeId = String(formData.get("employeeId") ?? "");
  const effectiveFrom = String(formData.get("effectiveFrom") ?? "");
  const numberFields = [
    "basicSalary",
    "hra",
    "da",
    "travelAllowance",
    "medicalAllowance",
    "specialAllowance",
    "bonus",
    "pf",
    "esi",
    "professionalTax",
    "incomeTax",
    "overtimeRate",
  ] as const;
  const values = Object.fromEntries(
    numberFields.map((field) => [field, Number(formData.get(field) ?? 0)])
  ) as Record<(typeof numberFields)[number], number>;

  if (!employeeId || !effectiveFrom) {
    return { error: "Please fill in all required fields." };
  }
  if (!Number.isFinite(values.basicSalary) || values.basicSalary <= 0) {
    return { error: "Enter a valid basic salary." };
  }
  for (const field of numberFields) {
    if (!Number.isFinite(values[field]) || values[field] < 0) {
      return { error: "Salary components must be valid, non-negative numbers." };
    }
  }

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
  if (!employee) {
    return { error: "Employee not found." };
  }

  await prisma.$transaction([
    prisma.salaryStructure.updateMany({
      where: { employeeId, isActive: true },
      data: { isActive: false },
    }),
    prisma.salaryStructure.create({
      data: {
        employeeId,
        effectiveFrom: new Date(effectiveFrom),
        isActive: true,
        ...values,
      },
    }),
  ]);

  revalidatePath(`/hrms/employees/${employeeId}`);
  return { success: true };
}

export async function createEmployee(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "HR"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const department = String(formData.get("department") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const dateOfJoining = String(formData.get("dateOfJoining") ?? "");
  const baseLocation = String(formData.get("baseLocation") ?? "").trim();
  const accessRole = String(formData.get("accessRole") ?? "");

  if (
    !name ||
    !role ||
    !department ||
    !email ||
    !phone ||
    !dateOfJoining ||
    !baseLocation ||
    !accessRole
  ) {
    return { error: "Please fill in all fields." };
  }

  const existingEmployee = await prisma.employee.findUnique({ where: { email } });
  if (existingEmployee) {
    return { error: "An employee with this email already exists." };
  }
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "A login already exists with this email." };
  }

  // employeeCode is globally unique (not scoped per organization), so the
  // count driving it must be global too — an org-scoped count would collide
  // with another organization's employees the moment both start from zero.
  const count = await prisma.employee.count();
  const employeeCode = `EOS-${String(count + 1).padStart(3, "0")}`;
  const { hash, salt } = hashPassword(DEFAULT_TEMP_PASSWORD);

  try {
    await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
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
          organizationId,
        },
      });

      await tx.user.create({
        data: {
          email,
          passwordHash: hash,
          passwordSalt: salt,
          accessRole: accessRole as AccessRole,
          employeeId: employee.id,
          organizationId,
          moduleAccess: {
            create: roleSectionAccess[accessRole as AccessRole].map((module) => ({ module })),
          },
        },
      });

      // Re-check the licence count *after* the insert, inside the same
      // transaction — see the identical guard in actions/admin.ts::createUserForEmployee.
      const subscription = await tx.subscription.findUnique({ where: { organizationId } });
      const licencedUsers = subscription?.licencedUsers ?? 0;
      const currentUserCount = await tx.user.count({ where: { organizationId } });
      if (currentUserCount > licencedUsers) {
        throw new LicenceLimitError(licencedUsers);
      }

      return employee;
    });
  } catch (err) {
    if (err instanceof LicenceLimitError) {
      return {
        error: `Your subscription includes ${err.licencedUsers} user licences. Please purchase additional licences to add more users.`,
      };
    }
    throw err;
  }

  const newUser = await prisma.user.findUnique({ where: { email } });
  if (newUser) {
    await notifyUser(
      newUser.id,
      "Welcome to the Exist Digitally Ops Platform — your portal access is ready. Your temporary password is 'demo123'.",
      "/me"
    );
  }

  revalidatePath("/hrms/employees");
  revalidatePath("/hrms");
  revalidatePath("/admin/users");
  return { success: true };
}

export async function createSelfEmployeeProfile(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const user = await getCurrentUser();
  if (user.employeeId) {
    return { error: "You already have an employee profile." };
  }
  const organizationId = user.organizationId!;

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const department = String(formData.get("department") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const dateOfJoining = String(formData.get("dateOfJoining") ?? "");
  const baseLocation = String(formData.get("baseLocation") ?? "").trim();

  if (!name || !role || !department || !phone || !dateOfJoining || !baseLocation) {
    return { error: "Please fill in all fields." };
  }

  // The user's own email may already exist as an unlinked Employee row (e.g.
  // HR added them separately before they completed this form) — link that
  // instead of creating a duplicate.
  const existingEmployee = await prisma.employee.findUnique({
    where: { email: user.email },
    include: { user: true },
  });
  if (existingEmployee) {
    if (existingEmployee.user) {
      return { error: "An employee record with your email is already linked to a different login." };
    }
    await prisma.user.update({ where: { id: user.id }, data: { employeeId: existingEmployee.id } });
    revalidatePath("/", "layout");
    return { success: true };
  }

  const count = await prisma.employee.count();
  const employeeCode = `EOS-${String(count + 1).padStart(3, "0")}`;

  const employee = await prisma.employee.create({
    data: {
      employeeCode,
      name,
      role: role as never,
      department,
      email: user.email,
      phone,
      dateOfJoining: new Date(dateOfJoining),
      baseLocation,
      avatarSeed: employeeCode,
      organizationId,
    },
  });

  await prisma.user.update({ where: { id: user.id }, data: { employeeId: employee.id } });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteEmployee(employeeId: string) {
  await requireRole(["ADMIN", "HR"]);
  const currentUser = await getCurrentUser();
  const organizationId = currentUser.organizationId!;

  if (currentUser.employeeId === employeeId) {
    throw new Error("You can't delete your own employee record.");
  }

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
  if (!employee) {
    throw new Error("Employee not found");
  }

  try {
    await prisma.$transaction([
      // Deleting the login along with the employee is intentional — portal
      // access shouldn't outlive the employee record it's attributed to.
      prisma.user.deleteMany({ where: { employeeId } }),
      prisma.employee.delete({ where: { id: employeeId } }),
    ]);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2003") {
      throw new Error(
        "Cannot delete this employee — they have existing HR or business records (attendance, leave, payroll, tasks, approvals, leads, etc.) linked to their profile."
      );
    }
    throw err;
  }

  revalidatePath("/hrms/employees");
  revalidatePath("/hrms");
  revalidatePath("/admin/users");
}

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadEmployeeDocument(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "HR"]);
  const uploader = await getCurrentUser();
  const organizationId = uploader.organizationId!;
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

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
  if (!employee) {
    return { error: "Employee not found." };
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
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const doc = await prisma.employeeDocument.findFirst({
    where: { id: documentId, employee: { organizationId } },
  });
  if (!doc) {
    throw new Error("Document not found");
  }

  await prisma.employeeDocument.delete({ where: { id: documentId } });
  await deleteFile(doc.storageKey);
  revalidatePath(`/hrms/employees/${doc.employeeId}`);
}
