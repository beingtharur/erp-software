import { prisma } from "@/lib/db";

export async function getMyNotifications(userId: string) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { notifications, unreadCount };
}
