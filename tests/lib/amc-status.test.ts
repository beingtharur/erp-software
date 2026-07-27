import { describe, expect, it } from "vitest";
import { computeAmcStatus } from "@/lib/amc-status";

describe("computeAmcStatus", () => {
  const now = new Date("2026-07-27T00:00:00Z");

  it("returns EXPIRED once endDate has passed, regardless of stored status", () => {
    expect(computeAmcStatus("2026-01-01", null, now)).toBe("EXPIRED");
  });

  it("returns EXPIRING_SOON within the contract's own renewalReminderDays window", () => {
    expect(computeAmcStatus("2026-08-05", 14, now)).toBe("EXPIRING_SOON"); // 9 days out
    expect(computeAmcStatus("2026-09-01", 14, now)).toBe("ACTIVE"); // 36 days out
  });

  it("falls back to a 30-day reminder window when renewalReminderDays isn't set", () => {
    expect(computeAmcStatus("2026-08-10", null, now)).toBe("EXPIRING_SOON"); // 14 days out
    expect(computeAmcStatus("2026-12-01", undefined, now)).toBe("ACTIVE");
  });

  it("treats endDate exactly today as expiring, not expired", () => {
    expect(computeAmcStatus("2026-07-27", 30, now)).toBe("EXPIRING_SOON");
  });
});
