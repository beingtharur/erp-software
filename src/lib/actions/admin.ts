"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { hashPassword } from "@/lib/password";
import { notifyUser } from "@/lib/notify";
import type { FormActionState } from "@/lib/actions/crm";
import type { AccessRole } from "@/generated/prisma/client";

export async function createUserForEmployee(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN"]);

  const employeeId = String(formData.get("employeeId") ?? "");
  const accessRole = String(formData.get("accessRole") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!employeeId || !accessRole || !password) {
    return { error: "Please fill in all fields." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });
  if (!employee) {
    return { error: "Employee not found." };
  }
  if (employee.user) {
    return { error: "This employee already has portal access." };
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: employee.email } });
  if (existingEmail) {
    return { error: "A login already exists with this employee's email." };
  }

  const { hash, salt } = hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      email: employee.email,
      passwordHash: hash,
      passwordSalt: salt,
      accessRole: accessRole as AccessRole,
      employeeId: employee.id,
    },
  });

  await notifyUser(newUser.id, "Welcome to the EOS Techno Ops Platform — your portal access is ready.", "/me");

  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUserRole(userId: string, accessRole: AccessRole) {
  await requireRole(["ADMIN"]);
  await prisma.user.update({ where: { id: userId }, data: { accessRole } });
  revalidatePath("/admin/users");
}

export async function revokeUserAccess(userId: string) {
  await requireRole(["ADMIN"]);
  const currentUser = await getCurrentUser();
  if (currentUser.id === userId) {
    throw new Error("You can't revoke your own access.");
  }
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}
