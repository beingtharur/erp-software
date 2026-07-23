"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { roleHome } from "@/lib/nav";

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
  });

  redirect(roleHome[user.accessRole] ?? "/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
