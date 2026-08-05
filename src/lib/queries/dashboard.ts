import { prisma } from "@/lib/db";
import { computeAmcStatus } from "@/lib/amc-status";
import { computeVendorPaymentStatus } from "@/lib/payment-status";

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
    unpaidVendorPayments,
    allAmcContracts,
    openPurchaseOrders,
    leadsByStage,
    projectsByLine,
    upcomingVisits,
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
    prisma.employee.count({ where: { status: "ACTIVE", organizationId, deletedAt: null } }),
    prisma.attendance.count({ where: { date: today, status: "PRESENT", employee: { organizationId } } }),
    prisma.visitLog.count({ where: { status: "CHECKED_IN", employee: { organizationId } } }),
    prisma.leaveRequest.count({ where: { status: "PENDING", employee: { organizationId } } }),
    // OVERDUE/EXPIRING_SOON are never recomputed at rest (see lib/payment-status.ts
    // and lib/amc-status.ts) — fetch the candidates and derive live status in JS
    // instead of filtering by the stale stored column.
    prisma.vendorPayment.findMany({
      where: { status: { not: "PAID" }, vendor: { organizationId } },
      select: { amount: true, dueDate: true, status: true },
    }),
    prisma.amcContract.findMany({
      where: { client: { organizationId } },
      orderBy: { endDate: "asc" },
      include: { client: true },
    }),
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

  const overduePaymentRows = unpaidVendorPayments.filter(
    (p) => computeVendorPaymentStatus(p) === "OVERDUE"
  );
  const overduePaymentsAmount = overduePaymentRows.reduce((sum, p) => sum + p.amount, 0);
  const overduePaymentsCount = overduePaymentRows.length;

  const amcWithLiveStatus = allAmcContracts.map((c) => ({
    ...c,
    status: computeAmcStatus(c.endDate, c.renewalReminderDays),
  }));
  const expiringAmc = amcWithLiveStatus.filter((c) => c.status === "EXPIRING_SOON").length;
  const amcExpiring = amcWithLiveStatus
    .filter((c) => c.status === "EXPIRING_SOON" || c.status === "ACTIVE")
    .slice(0, 5);

  return {
    openLeadsValue: openLeads._sum.value ?? 0,
    openLeadsCount: openLeads._count,
    activeProjectsValue: activeProjects._sum.value ?? 0,
    activeProjectsCount: activeProjects._count,
    totalActiveEmployees,
    presentToday,
    checkedInNow,
    pendingLeave,
    overduePaymentsAmount,
    overduePaymentsCount,
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
