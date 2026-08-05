"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { hashPassword } from "@/lib/password";
import { notifyUser } from "@/lib/notify";
import { roleSectionAccess, navSections } from "@/lib/nav";
import { withUniqueCodeRetry } from "@/lib/sequence";
import { logAudit } from "@/lib/audit";
import type { FormActionState } from "@/lib/actions/crm";
import type { AccessRole } from "@/generated/prisma/client";

const ALL_MODULE_KEYS = navSections.map((s) => s.key);

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

  // "new" mode's employee fields, validated up front but NOT created yet —
  // previously the Employee row was created here, outside (and before) the
  // transaction that creates the User. If the request was interrupted or the
  // transaction below failed for any reason (e.g. licence limit), the
  // Employee row was left committed with no login and no way to complete
  // it — a retry with the same email would just report "employee already
  // exists" forever. Both rows are now created inside the same transaction
  // so the whole operation is all-or-nothing.
  let newEmployeeFields:
    | {
        name: string;
        role: string;
        department: string;
        email: string;
        phone: string;
        dateOfJoining: string;
        baseLocation: string;
      }
    | undefined;
  let existingEmployee: { id: string; email: string } | undefined;

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

    const alreadyThere = await prisma.employee.findFirst({ where: { organizationId, email } });
    if (alreadyThere) {
      return { error: "An employee with this email already exists." };
    }
    newEmployeeFields = { name, role, department, email, phone, dateOfJoining, baseLocation };
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
    existingEmployee = found;
  }

  const employeeEmail = newEmployeeFields?.email ?? existingEmployee!.email;
  const existingEmail = await prisma.user.findUnique({ where: { email: employeeEmail } });
  if (existingEmail) {
    return { error: "A login already exists with this employee's email." };
  }

  const { hash, salt } = hashPassword(password);

  let newUser;
  try {
    newUser = await withUniqueCodeRetry(() =>
      prisma.$transaction(async (tx) => {
        let employeeId = existingEmployee?.id;

        if (newEmployeeFields) {
          // employeeCode is globally unique (not scoped per organization) - see
          // the same fix in actions/hrms.ts::createEmployee.
          const count = await tx.employee.count();
          const employeeCode = `EOS-${String(count + 1).padStart(3, "0")}`;
          const createdEmployee = await tx.employee.create({
            data: {
              employeeCode,
              name: newEmployeeFields.name,
              role: newEmployeeFields.role as never,
              department: newEmployeeFields.department,
              email: newEmployeeFields.email,
              phone: newEmployeeFields.phone,
              dateOfJoining: new Date(newEmployeeFields.dateOfJoining),
              baseLocation: newEmployeeFields.baseLocation,
              avatarSeed: employeeCode,
              organizationId,
            },
          });
          employeeId = createdEmployee.id;
        }

        const created = await tx.user.create({
          data: {
            email: employeeEmail,
            passwordHash: hash,
            passwordSalt: salt,
            accessRole: accessRole as AccessRole,
            employeeId: employeeId!,
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
        // and get rolled back here (which now also rolls back the Employee
        // row created above, instead of leaving it orphaned).
        const subscription = await tx.subscription.findUnique({ where: { organizationId } });
        const licencedUsers = subscription?.licencedUsers ?? 0;
        const currentUserCount = await tx.user.count({ where: { organizationId } });
        if (currentUserCount > licencedUsers) {
          throw new LicenceLimitError(licencedUsers);
        }

        return created;
      })
    );
  } catch (err) {
    if (err instanceof LicenceLimitError) {
      return {
        error: `Your subscription includes ${err.licencedUsers} user licences. Please purchase additional licences to add more users.`,
      };
    }
    throw err;
  }

  await notifyUser(newUser.id, "Welcome to the Exist Digitally Ops Platform — your portal access is ready.", "/me");

  revalidatePath("/admin/users");
  revalidatePath("/hrms/employees");
  return { success: true };
}

export async function updateUser(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN"]);
  const admin = await getCurrentUser();
  const organizationId = admin.organizationId!;

  const userId = String(formData.get("userId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const accessRole = String(formData.get("accessRole") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!userId || !email || !accessRole) {
    return { error: "Please fill in all fields." };
  }
  if (newPassword && newPassword.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const target = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!target) {
    return { error: "User not found." };
  }

  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== userId) {
    return { error: "Another user already has this email." };
  }

  let passwordFields: { passwordHash: string; passwordSalt: string } | undefined;
  if (newPassword) {
    const { hash, salt } = hashPassword(newPassword);
    passwordFields = { passwordHash: hash, passwordSalt: salt };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { email, accessRole: accessRole as AccessRole, ...passwordFields },
  });

  // This form is the one place an admin explicitly controls module access —
  // unlike the quick role-switch dropdown (updateUserRole), which stays
  // additive-only, here the submitted checkbox set is the real desired state:
  // grant what's checked, revoke what isn't. This is what makes module access
  // actually revocable instead of purely additive forever.
  const selectedModules = new Set(formData.getAll("modules").map(String));
  await prisma.$transaction([
    prisma.userModuleAccess.deleteMany({
      where: { userId, module: { in: ALL_MODULE_KEYS.filter((m) => !selectedModules.has(m)) } },
    }),
    ...[...selectedModules].map((moduleKey) =>
      prisma.userModuleAccess.upsert({
        where: { userId_module: { userId, module: moduleKey } },
        create: { userId, module: moduleKey },
        update: {},
      })
    ),
  ]);

  if (target.accessRole !== accessRole) {
    await logAudit({
      organizationId,
      actorId: admin.id,
      action: "user.role_changed",
      entityType: "User",
      entityId: userId,
      metadata: { from: target.accessRole, to: accessRole },
    });
  }

  revalidatePath("/admin/users");
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

  await logAudit({
    organizationId,
    actorId: admin.id,
    action: "user.role_changed",
    entityType: "User",
    entityId: userId,
    metadata: { accessRole },
  });

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
