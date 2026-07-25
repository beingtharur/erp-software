"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { hashPassword } from "@/lib/password";
import { notifyUser } from "@/lib/notify";
import { roleSectionAccess } from "@/lib/nav";
import type { FormActionState } from "@/lib/actions/crm";
import type { AccessRole } from "@/generated/prisma/client";

class LicenceLimitError extends Error {
  constructor(public licencedUsers: number) {
    super("Licence limit reached");
  }
}

export async function createUserForEmployee(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN"]);
  const admin = await getCurrentUser();
  const organizationId = admin.organizationId!;

  const mode = String(formData.get("mode") ?? "existing");
  const accessRole = String(formData.get("accessRole") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!accessRole || !password) {
    return { error: "Please fill in all fields." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  let employee: { id: string; email: string };

  if (mode === "new") {
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

    const existingEmployee = await prisma.employee.findUnique({ where: { email } });
    if (existingEmployee) {
      return { error: "An employee with this email already exists." };
    }

    const count = await prisma.employee.count({ where: { organizationId } });
    const employeeCode = `EOS-${String(count + 1).padStart(3, "0")}`;

    employee = await prisma.employee.create({
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
  } else {
    const employeeId = String(formData.get("employeeId") ?? "");
    if (!employeeId) {
      return { error: "Please select an employee." };
    }
    const found = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      include: { user: true },
    });
    if (!found) {
      return { error: "Employee not found." };
    }
    if (found.user) {
      return { error: "This employee already has portal access." };
    }
    employee = found;
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: employee.email } });
  if (existingEmail) {
    return { error: "A login already exists with this employee's email." };
  }

  const { hash, salt } = hashPassword(password);

  let newUser;
  try {
    newUser = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: employee.email,
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
      // transaction: the insert forces SQLite's write lock, so a concurrent
      // creation can't slip in between the count and the create — whichever
      // transaction commits first wins the last licence, and the loser's
      // recount (including its own just-inserted row) will be over the limit
      // and get rolled back here.
      const subscription = await tx.subscription.findUnique({ where: { organizationId } });
      const licencedUsers = subscription?.licencedUsers ?? 0;
      const currentUserCount = await tx.user.count({ where: { organizationId } });
      if (currentUserCount > licencedUsers) {
        throw new LicenceLimitError(licencedUsers);
      }

      return created;
    });
  } catch (err) {
    if (err instanceof LicenceLimitError) {
      return {
        error: `Your subscription includes ${err.licencedUsers} user licences. Please purchase additional licences to add more users.`,
      };
    }
    throw err;
  }

  await notifyUser(newUser.id, "Welcome to the EOS Techno Ops Platform — your portal access is ready.", "/me");

  revalidatePath("/admin/users");
  revalidatePath("/hrms/employees");
  return { success: true };
}

export async function updateUserRole(userId: string, accessRole: AccessRole) {
  await requireRole(["ADMIN"]);
  const admin = await getCurrentUser();
  const organizationId = admin.organizationId!;

  const result = await prisma.user.updateMany({
    where: { id: userId, organizationId },
    data: { accessRole },
  });
  if (result.count === 0) {
    throw new Error("User not found");
  }

  // Module access is additive on top of role defaults — grant the new role's
  // defaults without touching any extra modules an admin granted beyond that.
  for (const moduleKey of roleSectionAccess[accessRole]) {
    await prisma.userModuleAccess.upsert({
      where: { userId_module: { userId, module: moduleKey } },
      create: { userId, module: moduleKey },
      update: {},
    });
  }

  revalidatePath("/admin/users");
}

export async function revokeUserAccess(userId: string) {
  await requireRole(["ADMIN"]);
  const currentUser = await getCurrentUser();
  const organizationId = currentUser.organizationId!;

  if (currentUser.id === userId) {
    throw new Error("You can't revoke your own access.");
  }

  const target = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!target) {
    throw new Error("User not found");
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}
