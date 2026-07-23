import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionCookie, decrypt, type SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/db";

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
