import { prisma } from "@/lib/db";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardData() {
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
      where: { stage: { notIn: ["WON", "LOST"] } },
      _sum: { value: true },
      _count: true,
    }),
    prisma.project.aggregate({
      where: { status: { in: ["IN_PROGRESS", "COMMISSIONING"] } },
      _sum: { value: true },
      _count: true,
    }),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.attendance.count({ where: { date: today, status: "PRESENT" } }),
    prisma.visitLog.count({ where: { status: "CHECKED_IN" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.vendorPayment.aggregate({
      where: { status: "OVERDUE" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.amcContract.count({ where: { status: "EXPIRING_SOON" } }),
    prisma.purchaseOrder.count({ where: { status: { in: ["SENT", "CONFIRMED"] } } }),
    prisma.lead.groupBy({
      by: ["stage"],
      _count: true,
      _sum: { value: true },
    }),
    prisma.project.groupBy({
      by: ["productLine"],
      _count: true,
    }),
    prisma.siteVisit.findMany({
      where: { status: "SCHEDULED", scheduledDate: { gte: today } },
      orderBy: { scheduledDate: "asc" },
      take: 5,
      include: { client: true, assignedTo: true },
    }),
    prisma.amcContract.findMany({
      where: { status: { in: ["EXPIRING_SOON", "ACTIVE"] } },
      orderBy: { endDate: "asc" },
      take: 5,
      include: { client: true },
    }),
    prisma.visitLog.findMany({
      where: { status: "CHECKED_IN" },
      orderBy: { checkInTime: "desc" },
      take: 6,
      include: { employee: true, geofence: { include: { client: true } } },
    }),
    prisma.quotation.findMany({
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
