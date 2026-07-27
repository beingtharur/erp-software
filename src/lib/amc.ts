import { addDays, addMonths, differenceInCalendarDays } from "date-fns";

const BILLING_FREQUENCY_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  ANNUALLY: 12,
};

const DEFAULT_INTERVAL_MONTHS = 3;

// Precedence: an explicit billing frequency wins, then an even spread of the
// visits included across the contract's duration, then a quarterly default —
// so a contract with neither field set still gets a real next-service date
// instead of sitting permanently blank.
export function calculateNextServiceDate({
  from,
  startDate,
  endDate,
  billingFrequency,
  visitsIncluded,
}: {
  from: Date;
  startDate: Date;
  endDate: Date;
  billingFrequency?: string | null;
  visitsIncluded?: number | null;
}): Date {
  if (billingFrequency && billingFrequency in BILLING_FREQUENCY_MONTHS) {
    return addMonths(from, BILLING_FREQUENCY_MONTHS[billingFrequency]);
  }

  if (visitsIncluded && visitsIncluded > 0) {
    const totalDays = Math.max(differenceInCalendarDays(endDate, startDate), 1);
    const intervalDays = Math.max(Math.round(totalDays / visitsIncluded), 1);
    return addDays(from, intervalDays);
  }

  return addMonths(from, DEFAULT_INTERVAL_MONTHS);
}
