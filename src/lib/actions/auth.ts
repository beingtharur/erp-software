"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { roleHome, roleSectionAccess } from "@/lib/nav";
import { PRICING_CONFIG } from "@/lib/billing/pricing-config";

export type LoginState = { error?: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter both email and password." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: true },
  });

  if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    return { error: "Invalid email or password." };
  }

  await createSession({
    userId: user.id,
    accessRole: user.accessRole,
    name: user.employee?.name ?? user.email,
    organizationId: user.organizationId,
    isSuperAdmin: user.isSuperAdmin,
  });

  redirect(user.isSuperAdmin ? "/platform-admin" : (roleHome[user.accessRole] ?? "/"));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export type RegisterState = { error?: string } | undefined;

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || "org";
}

// Public self-registration: every brand-new organization gets exactly one
// 5-day trial (Subscription.organizationId is unique, so there's no code path
// that grants a second trial to an existing org). No Employee record is
// created — the first admin is a portal-only user, same as User.employeeId
// being optional everywhere else in the app.
export async function registerOrganization(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const orgName = String(formData.get("orgName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!orgName || !email || !password) {
    return { error: "Please fill in all fields." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  const baseSlug = slugify(orgName);
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const { hash, salt } = hashPassword(password);
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  const user = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: orgName, slug } });
    await tx.subscription.create({
      data: {
        organizationId: organization.id,
        status: "TRIAL",
        trialStartedAt: now,
        trialEndsAt,
        licencedUsers: PRICING_CONFIG.minimumUsers,
      },
    });
    return tx.user.create({
      data: {
        email,
        passwordHash: hash,
        passwordSalt: salt,
        accessRole: "ADMIN",
        organizationId: organization.id,
        moduleAccess: {
          create: roleSectionAccess.ADMIN.map((module) => ({ module })),
        },
      },
    });
  });

  await createSession({
    userId: user.id,
    accessRole: user.accessRole,
    name: user.email,
    organizationId: user.organizationId,
    isSuperAdmin: false,
  });

  redirect("/");
}
