import "server-only";
import { prisma } from "@/lib/db";
import type { AccessRole } from "@/generated/prisma/client";

export async function notifyUser(userId: string, message: string, href?: string) {
  await prisma.notification.create({ data: { userId, message, href } });
}

export async function notifyEmployee(employeeId: string, message: string, href?: string) {
  const user = await prisma.user.findUnique({ where: { employeeId }, select: { id: true } });
  if (!user) return;
  await notifyUser(user.id, message, href);
}

export async function notifyRole(role: AccessRole, message: string, href?: string) {
  const users = await prisma.user.findMany({ where: { accessRole: role }, select: { id: true } });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, message, href })),
  });
}
