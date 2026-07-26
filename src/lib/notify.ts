import "server-only";
import { prisma } from "@/lib/db";
import type { AccessRole, EmployeeRole } from "@/generated/prisma/client";

export async function notifyUser(userId: string, message: string, href?: string) {
  await prisma.notification.create({ data: { userId, message, href } });
}

export async function notifyEmployee(employeeId: string, message: string, href?: string) {
  const user = await prisma.user.findUnique({ where: { employeeId }, select: { id: true } });
  if (!user) return;
  await notifyUser(user.id, message, href);
}

export async function notifyRole(role: AccessRole, organizationId: string, message: string, href?: string) {
  const users = await prisma.user.findMany({
    where: { accessRole: role, organizationId },
    select: { id: true },
  });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, message, href })),
  });
}

// Broadcasts to every active employee with the given job title (EmployeeRole), as
// opposed to notifyRole's portal-permission (AccessRole) broadcast — there's no
// per-project PM assignment anywhere in the schema, so "notify the project managers"
// necessarily means everyone org-wide carrying that title.
export async function notifyEmployeeRole(
  role: EmployeeRole,
  organizationId: string,
  message: string,
  href?: string
) {
  const employees = await prisma.employee.findMany({
    where: { role, organizationId, status: "ACTIVE" },
    select: { id: true },
  });
  if (employees.length === 0) return;
  const users = await prisma.user.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) } },
    select: { id: true },
  });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, message, href })),
  });
}
