import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error("SESSION_SECRET environment variable is not set");
}
const encodedKey = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  userId: string;
  accessRole: "ADMIN" | "SALES" | "FIELD" | "HR" | "PROCUREMENT" | "FINANCE";
  name: string;
  // null only for the platform super-admin, who belongs to no single organization.
  organizationId: string | null;
  isSuperAdmin: boolean;
};

const COOKIE_NAME = "eos_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Defaults to NODE_ENV === "production" (unchanged behavior), but a `Secure`
// cookie is only ever sent by the browser over an actual HTTPS connection —
// on a production deployment still served over plain HTTP (no TLS/domain
// yet), that silently drops the cookie on every request after login. Set
// COOKIE_SECURE=false explicitly until real HTTPS is in front of the app.
const secureCookie =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decrypt(session?: string): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, encodedKey, { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await encrypt(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, session, {
    httpOnly: true,
    secure: secureCookie,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
  // A Secure cookie is only ever transmitted over HTTPS — set one on a site
  // served over plain HTTP and every browser silently discards it, so the user
  // appears to log in and is bounced straight back to /login. Logged so that
  // failure is visible in the server log instead of being invisible.
  console.log(
    `[auth] session-cookie-set ${JSON.stringify({
      secure: secureCookie,
      sameSite: "lax",
      httpOnly: true,
      expiresAt: expiresAt.toISOString(),
      cookieSecureEnv: process.env.COOKIE_SECURE ?? "(unset)",
      nodeEnv: process.env.NODE_ENV,
      warning: secureCookie ? "cookie will be DROPPED by the browser unless the site is served over HTTPS" : null,
    })}`
  );
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function readSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

export { COOKIE_NAME };
