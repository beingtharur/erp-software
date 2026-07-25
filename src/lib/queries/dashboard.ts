import { prisma } from "@/lib/db";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardData(organizationId: string) {
  const today = startOfToday();

  const [
    openLeads,
    activeProjects,
    totalActiveEmployees,
    presentToday,
    checkedInNow,
    pendingLeave,
    overduePayments,
    expiringAmc,
    openPurchaseOrders,
    leadsByStage,
    projectsByLine,
    upcomingVisits,
    amcExpiring,
    liveVisitLogs,
    recentQuotations,
  ] = await Promise.all([
    prisma.lead.aggregate({
      where: { stage: { notIn: ["WON", "LOST"] }, client: { organizationId } },
      _sum: { value: true },
      _count: true,
    }),
    prisma.project.aggregate({
      where: { status: { in: ["IN_PROGRESS", "COMMISSIONING"] }, client: { organizationId } },
      _sum: { value: true },
      _count: true,
    }),
    prisma.employee.count({ where: { status: "ACTIVE", organizationId } }),
    prisma.attendance.count({ where: { date: today, status: "PRESENT", employee: { organizationId } } }),
    prisma.visitLog.count({ where: { status: "CHECKED_IN", employee: { organizationId } } }),
    prisma.leaveRequest.count({ where: { status: "PENDING", employee: { organizationId } } }),
    prisma.vendorPayment.aggregate({
      where: { status: "OVERDUE", vendor: { organizationId } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.amcContract.count({ where: { status: "EXPIRING_SOON", client: { organizationId } } }),
    prisma.purchaseOrder.count({
      where: { status: { in: ["SENT", "CONFIRMED"] }, vendor: { organizationId } },
    }),
    prisma.lead.groupBy({
      by: ["stage"],
      _count: true,
      _sum: { value: true },
      where: { client: { organizationId } },
    }),
    prisma.project.groupBy({
      by: ["productLine"],
      _count: true,
      where: { client: { organizationId } },
    }),
    prisma.siteVisit.findMany({
      where: { status: "SCHEDULED", scheduledDate: { gte: today }, client: { organizationId } },
      orderBy: { scheduledDate: "asc" },
      take: 5,
      include: { client: true, assignedTo: true },
    }),
    prisma.amcContract.findMany({
      where: { status: { in: ["EXPIRING_SOON", "ACTIVE"] }, client: { organizationId } },
      orderBy: { endDate: "asc" },
      take: 5,
      include: { client: true },
    }),
    prisma.visitLog.findMany({
      where: { status: "CHECKED_IN", employee: { organizationId } },
      orderBy: { checkInTime: "desc" },
      take: 6,
      include: { employee: true, geofence: { include: { client: true } } },
    }),
    prisma.quotation.findMany({
      where: { client: { organizationId } },
      orderBy: { issuedOn: "desc" },
      take: 5,
      include: { client: true },
    }),
  ]);

  return {
    openLeadsValue: openLeads._sum.value ?? 0,
    openLeadsCount: openLeads._count,
    activeProjectsValue: activeProjects._sum.value ?? 0,
    activeProjectsCount: activeProjects._count,
    totalActiveEmployees,
    presentToday,
    checkedInNow,
    pendingLeave,
    overduePaymentsAmount: overduePayments._sum.amount ?? 0,
    overduePaymentsCount: overduePayments._count,
    expiringAmc,
    openPurchaseOrders,
    leadsByStage,
    projectsByLine,
    upcomingVisits,
    amcExpiring,
    liveVisitLogs,
    recentQuotations,
  };
}
