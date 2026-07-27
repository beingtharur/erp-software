// AmcContract.status was previously a plain stored enum, set once at seed
// time and never recomputed — a contract seeded ACTIVE stays ACTIVE forever
// in the DB even after its endDate passes. This computes the real status
// live from the contract's dates every time it's read, instead of trusting
// the stored column. `renewalReminderDays` is per-contract (set when a
// contract is created from a completed project); contracts without one
// (older/seeded ones) fall back to a 30-day default reminder window.
import { daysUntil } from "@/lib/format";
import type { AmcStatus } from "@/generated/prisma/enums";

const DEFAULT_REMINDER_DAYS = 30;

export function computeAmcStatus(
  endDate: Date | string,
  renewalReminderDays: number | null | undefined,
  now: Date = new Date()
): AmcStatus {
  const daysLeft = Math.ceil((new Date(endDate).getTime() - now.getTime()) / 86400000);
  if (daysLeft < 0) return "EXPIRED";
  const reminderWindow = renewalReminderDays && renewalReminderDays > 0 ? renewalReminderDays : DEFAULT_REMINDER_DAYS;
  if (daysLeft <= reminderWindow) return "EXPIRING_SOON";
  return "ACTIVE";
}

/** Re-exported for callers that already import daysUntil alongside this. */
export { daysUntil };
