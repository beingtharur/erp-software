import { describe, expect, it } from "vitest";
import { haversineMeters, isWithinGeofence } from "@/lib/geo";

describe("haversineMeters", () => {
  it("returns ~0 for the same point", () => {
    expect(haversineMeters(22.3, 73.2, 22.3, 73.2)).toBeCloseTo(0, 3);
  });

  it("returns a sane distance for two nearby points (~1.1km apart)", () => {
    // Roughly 0.01 degrees of latitude ~ 1.1km.
    const d = haversineMeters(22.30, 73.20, 22.31, 73.20);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1300);
  });
});

describe("isWithinGeofence", () => {
  const zone = { latitude: 22.3072, longitude: 73.1812, radiusMeters: 300 };

  it("accepts a point at the zone center", () => {
    expect(isWithinGeofence(zone.latitude, zone.longitude, zone)).toBe(true);
  });

  it("rejects a point far outside the radius + buffer", () => {
    expect(isWithinGeofence(22.40, 73.30, zone)).toBe(false);
  });

  it("accepts a point just inside the radius+buffer edge", () => {
    // ~320m north — within 300m radius + 25m buffer.
    expect(isWithinGeofence(22.3101, zone.longitude, zone)).toBe(true);
  });

  it("rejects a point clearly beyond the radius+buffer", () => {
    // ~1km north — well outside 300m + 25m buffer.
    expect(isWithinGeofence(22.316, zone.longitude, zone)).toBe(false);
  });
});
