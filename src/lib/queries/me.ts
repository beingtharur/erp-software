import { prisma } from "@/lib/db";

export async function getMyAttendance(employeeId: string) {
  return prisma.attendance.findMany({
    where: { employeeId },
    orderBy: { date: "desc" },
    take: 14,
  });
}

export async function getMyLeaveRequests(employeeId: string) {
  return prisma.leaveRequest.findMany({
    where: { employeeId },
    orderBy: { appliedOn: "desc" },
    take: 10,
  });
}

export async function getMyTimesheets(employeeId: string) {
  return prisma.timesheet.findMany({
    where: { employeeId },
    orderBy: { date: "desc" },
    take: 10,
    include: { project: true },
  });
}

export async function getMyTasks(employeeId: string) {
  return prisma.personalTask.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProjectOptions() {
  return prisma.project.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
