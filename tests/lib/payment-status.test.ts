import { describe, expect, it } from "vitest";
import { computeVendorPaymentStatus } from "@/lib/payment-status";

describe("computeVendorPaymentStatus", () => {
  const now = new Date("2026-07-27T00:00:00Z");

  it("stays PAID regardless of due date", () => {
    expect(computeVendorPaymentStatus({ status: "PAID", dueDate: "2020-01-01" }, now)).toBe("PAID");
  });

  it("recomputes OVERDUE for a stale PENDING payment past its due date, unlike the static seed-time value", () => {
    expect(computeVendorPaymentStatus({ status: "PENDING", dueDate: "2026-01-01" }, now)).toBe("OVERDUE");
  });

  it("also recognizes a stored OVERDUE value that has since become PENDING-worthy (shouldn't happen, but stays consistent)", () => {
    expect(computeVendorPaymentStatus({ status: "OVERDUE", dueDate: "2027-01-01" }, now)).toBe("PENDING");
  });

  it("stays PENDING before the due date", () => {
    expect(computeVendorPaymentStatus({ status: "PENDING", dueDate: "2026-08-01" }, now)).toBe("PENDING");
  });
});
