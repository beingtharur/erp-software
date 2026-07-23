import { prisma } from "@/lib/db";

export async function getFieldMapData() {
  const [geofences, fieldEmployees, activeVisits] = await Promise.all([
    prisma.geofenceZone.findMany({ include: { client: true } }),
    prisma.employee.findMany({
      where: { role: { in: ["INSTALLATION_CREW", "TECHNICIAN", "SALES_REP"] }, status: "ACTIVE" },
      include: {
        locationPings: { orderBy: { timestamp: "desc" }, take: 1, include: { geofence: true } },
      },
    }),
    prisma.visitLog.findMany({
      where: { status: "CHECKED_IN" },
      include: { geofence: { include: { client: true } } },
    }),
  ]);

  const activeVisitByEmployee = new Map(activeVisits.map((v) => [v.employeeId, v]));

  const reps = fieldEmployees
    .map((emp) => {
      const ping = emp.locationPings[0];
      if (!ping) return null;
      const activeVisit = activeVisitByEmployee.get(emp.id);
      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        department: emp.department,
        latitude: ping.latitude,
        longitude: ping.longitude,
        geofenceId: ping.geofenceId,
        geofenceName: ping.geofence?.name ?? null,
        isCheckedIn: Boolean(activeVisit),
        checkInTime: activeVisit?.checkInTime ?? null,
        visitPurpose: activeVisit?.purpose ?? null,
        isDeviceGps: ping.isDeviceGps,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

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

export async function getGeofenceOptions() {
  return prisma.geofenceZone.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getVisitLogs() {
  return prisma.visitLog.findMany({
    orderBy: { checkInTime: "desc" },
    include: { employee: true, geofence: { include: { client: true } } },
  });
}

export async function getGeofences() {
  return prisma.geofenceZone.findMany({
    include: { client: true, project: true, _count: { select: { visitLogs: true } } },
    orderBy: { name: "asc" },
  });
}
