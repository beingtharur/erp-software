import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionCookie, decrypt, type SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/db";
import { computeEffectiveAccess, type EffectiveAccess } from "@/lib/billing/access";
import type { NavSection } from "@/lib/nav";

export const verifySession = cache(async (): Promise<SessionPayload> => {
  const cookie = await readSessionCookie();
  const session = await decrypt(cookie);

  if (!session?.userId) {
    redirect("/login");
  }

  return session;
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { employee: true },
  });

  if (!user) {
    // Session cookie points at a user that no longer exists (e.g. after a reseed).
    // Server Components can't clear cookies — proxy.ts does that when it sees this marker,
    // otherwise it'd treat the still-valid JWT as "logged in" and bounce /login back here.
    redirect("/login?session=expired");
  }

  return user;
});

export async function requireRole(allowed: SessionPayload["accessRole"][]) {
  const session = await verifySession();
  if (!allowed.includes(session.accessRole)) {
    redirect("/access-denied");
  }
  return session;
}

// Platform operator (reviews payments across every organization) — deliberately
// distinct from the per-org "ADMIN" AccessRole, which never has isSuperAdmin.
export async function requireSuperAdmin() {
  const session = await verifySession();
  if (!session.isSuperAdmin) {
    redirect("/access-denied");
  }
  return session;
}

export const getCurrentOrganization = cache(async () => {
  const session = await verifySession();
  if (!session.organizationId) {
    // Only the super-admin has no organizationId, and they never call this.
    redirect("/access-denied");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    include: { subscription: { include: { modules: true } } },
  });

  if (!organization) {
    redirect("/login?session=expired");
  }

  return organization;
});

// Trial-or-subscription gate for the whole app shell. Computed live from
// timestamps (see computeEffectiveAccess) — never trusts a possibly-stale
// status column.
export async function requireActiveAccess(): Promise<EffectiveAccess> {
  const organization = await getCurrentOrganization();
  const access = computeEffectiveAccess(organization.subscription);
  if (!access.hasAccess) {
    redirect("/subscription");
  }
  return access;
}

// Module-level gate, layered on top of requireActiveAccess(): the org's plan
// must include the module, AND this specific user must be granted it. Frontend
// nav hiding is UX only — this is the actual security boundary.
export async function requireModuleAccess(module: NavSection["key"]): Promise<EffectiveAccess> {
  const session = await verifySession();
  const access = await requireActiveAccess();

  if (!access.unlockedModules.includes(module)) {
    redirect(`/subscription?blocked=module&m=${module}`);
  }

  const grant = await prisma.userModuleAccess.findUnique({
    where: { userId_module: { userId: session.userId, module } },
  });
  if (!grant) {
    redirect("/access-denied");
  }

  return access;
}
