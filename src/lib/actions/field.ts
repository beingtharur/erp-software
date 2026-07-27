"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { isWithinGeofence } from "@/lib/geo";
import type { FormActionState } from "@/lib/actions/crm";

function jitter(lat: number, lng: number, maxMeters: number) {
  const dLat = (Math.random() - 0.5) * 2 * (maxMeters / 111_320);
  const dLng =
    (Math.random() - 0.5) * 2 * (maxMeters / (111_320 * Math.cos((lat * Math.PI) / 180)));
  return { lat: lat + dLat, lng: lng + dLng };
}

// Previously there was no way to create a Site/GeofenceZone anywhere in the
// app — the read-only Geofences table and the check-in Site picker could
// only ever show zones seeded directly in the database, so a freshly
// registered org had zero sites and no way to add one. Gated ADMIN-only:
// defining a site is a one-time config action, not something a FIELD rep
// does day-to-day (mirrors Client/Vendor creation being ADMIN/role-gated
// elsewhere).
export async function createGeofence(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const name = String(formData.get("name") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "") || null;
  const projectId = String(formData.get("projectId") ?? "") || null;
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  const radiusRaw = formData.get("radiusMeters");
  const radiusMeters = radiusRaw ? Number(radiusRaw) : 300;

  if (!name) {
    return { error: "Enter a site name." };
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { error: "Enter a valid latitude (-90 to 90)." };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { error: "Enter a valid longitude (-180 to 180)." };
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    return { error: "Enter a valid radius in meters." };
  }

  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
    if (!client) return { error: "Client not found." };
  }
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, client: { organizationId } } });
    if (!project) return { error: "Project not found." };
  }

  await prisma.geofenceZone.create({
    data: {
      name,
      organizationId,
      clientId,
      projectId,
      latitude,
      longitude,
      radiusMeters: Math.round(radiusMeters),
    },
  });

  revalidatePath("/field/geofences");
  revalidatePath("/field");
  return { success: true };
}

export async function checkIn(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "FIELD"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  if (!user.employeeId) {
    return { error: "No employee record linked to this account." };
  }

  const geofenceId = String(formData.get("geofenceId") ?? "");
  const purpose = String(formData.get("purpose") ?? "").trim();

  if (!geofenceId || !purpose) {
    return { error: "Please select a site and enter a purpose." };
  }

  const existing = await prisma.visitLog.findFirst({
    where: { employeeId: user.employeeId, status: "CHECKED_IN" },
  });
  if (existing) {
    return { error: "You're already checked in somewhere. Check out first." };
  }

  const zone = await prisma.geofenceZone.findFirst({ where: { id: geofenceId, organizationId } });
  if (!zone) {
    return { error: "Site not found." };
  }

  const latRaw = formData.get("latitude");
  const lngRaw = formData.get("longitude");
  const deviceLat = latRaw ? Number(latRaw) : NaN;
  const deviceLng = lngRaw ? Number(lngRaw) : NaN;
  const hasDeviceFix = Number.isFinite(deviceLat) && Number.isFinite(deviceLng);

  // Real device fixes must actually fall within the drawn geofence radius
  // (plus a small GPS-accuracy buffer) — previously any coordinates were
  // trusted and stored regardless of whether they were anywhere near the
  // site. The jitter() fallback (no device fix available) is exempt since it
  // always synthesizes a point inside the zone by construction.
  if (hasDeviceFix && !isWithinGeofence(deviceLat, deviceLng, zone)) {
    return { error: `You're too far from ${zone.name} to check in — move closer and try again.` };
  }

  const pos = hasDeviceFix
    ? { lat: deviceLat, lng: deviceLng }
    : jitter(zone.latitude, zone.longitude, Math.min(zone.radiusMeters * 0.5, 150));

  await prisma.$transaction([
    prisma.visitLog.create({
      data: {
        employeeId: user.employeeId,
        geofenceId,
        purpose,
        checkInTime: new Date(),
        status: "CHECKED_IN",
      },
    }),
    prisma.locationPing.create({
      data: {
        employeeId: user.employeeId,
        latitude: pos.lat,
        longitude: pos.lng,
        geofenceId,
        isDeviceGps: hasDeviceFix,
      },
    }),
  ]);

  revalidatePath("/field");
  revalidatePath("/field/visits");
  revalidatePath("/");
  return { success: true };
}

// Previously a LocationPing was only ever recorded once, at check-in — the
// "moving dot" on the live map was purely a client-side cosmetic animation
// that never touched the database, so there was no real trail of where a
// rep actually went during a visit. The client now calls this periodically
// (see MyFieldStatus) while checked in, so genuine device fixes accumulate
// real history; called with no active checked-in visit, it's a no-op.
export async function recordLocationPing(latitude: number, longitude: number) {
  await requireRole(["ADMIN", "FIELD"]);
  const user = await getCurrentUser();
  if (!user.employeeId) return;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

  const visit = await prisma.visitLog.findFirst({
    where: { employeeId: user.employeeId, status: "CHECKED_IN" },
  });
  if (!visit) return;

  await prisma.locationPing.create({
    data: {
      employeeId: user.employeeId,
      latitude,
      longitude,
      geofenceId: visit.geofenceId,
      isDeviceGps: true,
    },
  });

  revalidatePath("/field");
}

export async function checkOut(visitId: string) {
  await requireRole(["ADMIN", "FIELD"]);
  const user = await getCurrentUser();

  const visit = await prisma.visitLog.findUnique({ where: { id: visitId } });
  if (!visit || visit.employeeId !== user.employeeId) {
    throw new Error("Not authorized to check out this visit");
  }

  const checkOutTime = new Date();
  const durationMinutes = Math.round(
    (checkOutTime.getTime() - visit.checkInTime.getTime()) / 60000
  );

  await prisma.visitLog.update({
    where: { id: visitId },
    data: { status: "CHECKED_OUT", checkOutTime, durationMinutes },
  });

  revalidatePath("/field");
  revalidatePath("/field/visits");
  revalidatePath("/");
}
