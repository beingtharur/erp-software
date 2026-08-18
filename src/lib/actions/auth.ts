"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { roleHome, roleSectionAccess } from "@/lib/nav";
import { buildInitialSubscription } from "@/lib/billing/dev-mode";
import { withUniqueCodeRetry } from "@/lib/sequence";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";

export type LoginState = { error?: string } | undefined;

// Describes a credential WITHOUT ever logging it. Login is deterministic
// server-side — same bytes plus same database always give the same answer — so
// when one device succeeds and another fails on "the same" password, the bytes
// actually submitted must differ. These are the differences that hide: an
// autofilled trailing space, a non-breaking space from a password manager, a
// smart quote from a mobile keyboard.
function fingerprint(value: string) {
  return {
    length: value.length,
    leadingWhitespace: /^\s/.test(value),
    trailingWhitespace: /\s$/.test(value),
    nonAscii: /[^\x20-\x7E]/.test(value),
    firstCode: value.charCodeAt(0),
    lastCode: value.charCodeAt(value.length - 1),
  };
}

function authLog(stage: string, data: Record<string, unknown>) {
  console.log(`[auth] ${stage} ${JSON.stringify(data)}`);
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = String(formData.get("email") ?? "");
  const email = rawEmail.trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const ua = (await headers()).get("user-agent") ?? "unknown";

  if (!email || !password) {
    authLog("missing-field", { emailPresent: Boolean(email), passwordPresent: Boolean(password), ua });
    return { error: "Enter both email and password." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: true },
  });

  if (!user) {
    // A near-match means the row exists but the stored address doesn't equal the
    // normalized one — e.g. it was saved with capitals, which SQLite's
    // case-sensitive unique index will never match after .toLowerCase().
    const near = await prisma.user.findFirst({
      where: { email: { contains: email } },
      select: { email: true },
    });
    authLog("lookup-miss", {
      submittedEmail: rawEmail,
      normalizedEmail: email,
      emailFingerprint: fingerprint(rawEmail),
      caseOrWhitespaceNearMatch: near?.email ?? null,
      ua,
    });
    return { error: "Invalid email or password." };
  }

  if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    // Re-check against the trimmed password. If THIS passes, the account and
    // the password are both correct and the only problem was invisible
    // whitespace the device added — which is exactly the "works on one device,
    // fails on another" report. Diagnostic only: the login still fails.
    const trimmedWouldPass = verifyPassword(password.trim(), user.passwordHash, user.passwordSalt);
    authLog("password-mismatch", {
      email,
      userId: user.id,
      passwordFingerprint: fingerprint(password),
      trimmedWouldPass,
      ua,
    });
    return { error: "Invalid email or password." };
  }

  authLog("verified", { email, userId: user.id, accessRole: user.accessRole, ua });

  try {
    await createSession({
      userId: user.id,
      accessRole: user.accessRole,
      name: user.employee?.name ?? user.email,
      organizationId: user.organizationId,
      isSuperAdmin: user.isSuperAdmin,
    });
  } catch (err) {
    authLog("session-create-failed", { email, userId: user.id, error: String(err), ua });
    throw err;
  }

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
// that grants a second trial to an existing org). The admin's Employee record
// is auto-created in the same transaction (role ADMIN, joining today) using the
// same employeeCode/withUniqueCodeRetry pattern as every other employee-creation
// path (createEmployee, createSelfEmployeeProfile) — so Attendance/Leave/
// Timesheets/Payroll/HR dashboards work immediately, with no separate "complete
// your profile" step required for the one field (name) this form didn't
// previously collect. department/phone/baseLocation are left blank rather than
// guessed; they're editable later via updateEmployee. This is intentionally
// reversible: deleteEmployee soft-deletes (see Employee.deletedAt), so an admin
// who never wants an HR profile can remove it after the fact.
export async function registerOrganization(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const orgName = String(formData.get("orgName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!orgName || !name || !email || !password) {
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

  const user = await withUniqueCodeRetry(() =>
    prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name: orgName, slug } });
      // Normally a 5-day trial; a full plan when development subscription mode
      // is on. Either way it's an ordinary Subscription row, so every access
      // check downstream behaves the same (see lib/billing/dev-mode.ts).
      await tx.subscription.create({
        data: {
          ...buildInitialSubscription(now),
          organization: { connect: { id: organization.id } },
        },
      });

      // employeeCode is globally unique (not scoped per organization) — see the
      // identical comment in actions/hrms.ts::createEmployee.
      const count = await tx.employee.count();
      const employeeCode = `EOS-${String(count + 1).padStart(3, "0")}`;
      const employee = await tx.employee.create({
        data: {
          employeeCode,
          name,
          role: "ADMIN",
          email,
          phone: "",
          dateOfJoining: now,
          baseLocation: "",
          avatarSeed: employeeCode,
          organizationId: organization.id,
        },
      });

      return tx.user.create({
        data: {
          email,
          passwordHash: hash,
          passwordSalt: salt,
          accessRole: "ADMIN",
          employeeId: employee.id,
          organizationId: organization.id,
          moduleAccess: {
            create: roleSectionAccess.ADMIN.map((module) => ({ module })),
          },
        },
      });
    })
  );

  await logAudit({
    organizationId: user.organizationId!,
    actorId: user.id,
    action: "employee.created",
    entityType: "Employee",
    entityId: user.employeeId!,
    metadata: { source: "registration" },
  });

  await createSession({
    userId: user.id,
    accessRole: user.accessRole,
    name,
    organizationId: user.organizationId,
    isSuperAdmin: false,
  });

  redirect("/");
}
