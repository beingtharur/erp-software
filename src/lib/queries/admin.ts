import { prisma } from "@/lib/db";

export async function getUsers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEmployeesWithoutLogin(organizationId: string) {
  return prisma.employee.findMany({
    where: { user: null, status: "ACTIVE", organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeCode: true, email: true, role: true, department: true },
  });
}
