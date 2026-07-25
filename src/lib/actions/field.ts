"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import type { FormActionState } from "@/lib/actions/crm";

function jitter(lat: number, lng: number, maxMeters: number) {
  const dLat = (Math.random() - 0.5) * 2 * (maxMeters / 111_320);
  const dLng =
    (Math.random() - 0.5) * 2 * (maxMeters / (111_320 * Math.cos((lat * Math.PI) / 180)));
  return { lat: lat + dLat, lng: lng + dLng };
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
