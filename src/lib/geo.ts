// Field check-in previously trusted whatever coordinates the device (or the
// jitter() fallback) produced, with no check that they actually fall inside
// the geofence's drawn radius — the circle on the live map was purely
// cosmetic. haversineMeters gives the real great-circle distance between two
// points so check-in can validate containment for real device fixes.
const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * True if (lat, lng) falls within radiusMeters of the zone center, allowing a
 * small buffer for consumer GPS inaccuracy (typically 5-20m even with a good
 * fix) so legitimate check-ins near the edge of a zone aren't rejected.
 */
export function isWithinGeofence(
  lat: number,
  lng: number,
  zone: { latitude: number; longitude: number; radiusMeters: number },
  bufferMeters = 25
): boolean {
  return haversineMeters(lat, lng, zone.latitude, zone.longitude) <= zone.radiusMeters + bufferMeters;
}
