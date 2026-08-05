import { prisma } from "@/lib/db";

export async function getFieldMapData(organizationId: string) {
  const [geofences, fieldEmployees, activeVisits] = await Promise.all([
    prisma.geofenceZone.findMany({ where: { organizationId }, include: { client: true } }),
    prisma.employee.findMany({
      where: {
        role: { in: ["INSTALLATION_CREW", "TECHNICIAN", "SALES_REP"] },
        status: "ACTIVE",
        organizationId,
        deletedAt: null,
      },
      include: {
        locationPings: { orderBy: { timestamp: "desc" }, take: 1, include: { geofence: true } },
      },
    }),
    prisma.visitLog.findMany({
      where: { status: "CHECKED_IN", employee: { organizationId } },
      include: { geofence: { include: { client: true } } },
    }),
  ]);

  const activeVisitByEmployee = new Map(activeVisits.map((v) => [v.employeeId, v]));

  // Previously an employee with zero LocationPing rows ever was filtered out
  // entirely — invisible everywhere on this page, including the "Off Site"
  // headcount list, until their first check-in. They now still appear (with
  // no map marker, since there's no coordinate to place one at) so an admin
  // auditing field headcount doesn't see someone silently missing.
  const reps = fieldEmployees.map((emp) => {
    const ping = emp.locationPings[0];
    const activeVisit = activeVisitByEmployee.get(emp.id);
    return {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      department: emp.department,
      latitude: ping?.latitude ?? null,
      longitude: ping?.longitude ?? null,
      geofenceId: ping?.geofenceId ?? null,
      geofenceName: ping?.geofence?.name ?? null,
      isCheckedIn: Boolean(activeVisit),
      checkInTime: activeVisit?.checkInTime ?? null,
      visitPurpose: activeVisit?.purpose ?? null,
      isDeviceGps: ping?.isDeviceGps ?? false,
      hasCheckedInEver: Boolean(ping),
    };
  });

  return {
    geofences: geofences.map((g) => ({
      id: g.id,
      name: g.name,
      clientName: g.client?.name ?? null,
      latitude: g.latitude,
      longitude: g.longitude,
      radiusMeters: g.radiusMeters,
    })),
    reps,
  };
}

export async function getMyActiveVisit(employeeId: string) {
  return prisma.visitLog.findFirst({
    where: { employeeId, status: "CHECKED_IN" },
    include: { geofence: { include: { client: true } } },
  });
}

export async function getGeofenceOptions(organizationId: string) {
  return prisma.geofenceZone.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getVisitLogs(organizationId: string) {
  return prisma.visitLog.findMany({
    where: { employee: { organizationId } },
    orderBy: { checkInTime: "desc" },
    include: { employee: true, geofence: { include: { client: true } } },
  });
}

export async function getGeofences(organizationId: string) {
  return prisma.geofenceZone.findMany({
    where: { organizationId },
    include: { client: true, project: true, _count: { select: { visitLogs: true } } },
    orderBy: { name: "asc" },
  });
}
