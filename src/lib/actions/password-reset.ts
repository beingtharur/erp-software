"use server";

import { randomBytes, createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { sendPasswordResetEmail } from "@/lib/email";
import type { FormActionState } from "@/lib/actions/crm";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function getBaseUrl(): Promise<string> {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = process.env.COOKIE_SECURE === "true" ? "https" : "http";
  return `${protocol}://${host}`;
}

export async function requestPasswordReset(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { error: "Enter your email address." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always the same outcome whether or not the email exists — otherwise this
  // form becomes a way to check which emails have accounts.
  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const baseUrl = await getBaseUrl();
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(email, resetUrl);
  }

  return { success: true };
}

export async function resetPassword(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { error: "Missing reset token." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const tokenHash = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const { hash, salt } = hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: hash, passwordSalt: salt },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other outstanding reset requests for this user too —
    // a fresh password shouldn't leave older links still able to reset it.
    prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}
