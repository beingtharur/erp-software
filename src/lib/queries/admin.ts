import { prisma } from "@/lib/db";

export async function getUsers() {
  return prisma.user.findMany({
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEmployeesWithoutLogin() {
  return prisma.employee.findMany({
    where: { user: null, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeCode: true, email: true, role: true, department: true },
  });
}
