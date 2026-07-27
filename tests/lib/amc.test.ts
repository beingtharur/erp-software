import { describe, expect, it } from "vitest";
import { calculateNextServiceDate } from "@/lib/amc";

describe("calculateNextServiceDate", () => {
  const startDate = new Date("2026-01-01");
  const endDate = new Date("2026-12-31");

  it("uses the billing frequency when set, regardless of visits included", () => {
    const result = calculateNextServiceDate({
      from: startDate,
      startDate,
      endDate,
      billingFrequency: "QUARTERLY",
      visitsIncluded: 12,
    });
    expect(result).toEqual(new Date("2026-04-01"));
  });

  it("spreads visits included evenly across the contract duration when no billing frequency is set", () => {
    const result = calculateNextServiceDate({
      from: startDate,
      startDate,
      endDate,
      billingFrequency: null,
      visitsIncluded: 4,
    });
    // 364 days / 4 visits = 91 days
    expect(result).toEqual(new Date("2026-04-02"));
  });

  it("falls back to a quarterly default when neither field is set, so it's never left blank", () => {
    const result = calculateNextServiceDate({
      from: startDate,
      startDate,
      endDate,
      billingFrequency: null,
      visitsIncluded: null,
    });
    expect(result).toEqual(new Date("2026-04-01"));
  });

  it("recalculates from the actual service date when completing a service, not the contract start", () => {
    const serviceDate = new Date("2026-06-15");
    const result = calculateNextServiceDate({
      from: serviceDate,
      startDate,
      endDate,
      billingFrequency: "MONTHLY",
      visitsIncluded: null,
    });
    expect(result).toEqual(new Date("2026-07-15"));
  });
});
