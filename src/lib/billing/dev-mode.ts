import { ALL_MODULE_KEYS } from "@/lib/billing/access";
import { PRICING_CONFIG } from "@/lib/billing/pricing-config";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Development subscription mode.
 *
 * The 5-day trial and per-module plan gating are real product behaviour, and
 * nothing here removes or bypasses them: `computeEffectiveAccess`,
 * `requireActiveAccess`, `requireModuleAccess` and the proxy are all untouched
 * and evaluate exactly as they do in production. The only thing this changes is
 * *what a brand-new organization is provisioned with* — in dev mode it is given
 * a real, fully-featured subscription instead of a short trial, so testers stop
 * hitting the paywall mid-session.
 *
 * Turning it off is a single environment variable, and normal trial behaviour
 * returns for every organization registered afterwards. Organizations already
 * provisioned keep the subscription they were given (as they would if a real
 * plan had been purchased) — clearing those is a data decision, not a code one.
 */
export function isDevSubscriptionMode() {
  // Defaults to OFF, including when unset, so a production deploy that forgets
  // to define the variable cannot accidentally hand out free plans.
  return process.env.DEV_SUBSCRIPTION_MODE === "true";
}

/** How long a dev-mode subscription runs before it would need renewing. */
const DEV_PERIOD_YEARS = 5;
/** Generous enough that licence-limit errors don't interrupt testing. */
const DEV_LICENCED_USERS = 100;

export const TRIAL_DAYS = 5;

/**
 * The subscription a newly registered organization starts with. Returns plain
 * Prisma input rather than performing the write, so the caller keeps it inside
 * its existing registration transaction.
 */
export function buildInitialSubscription(
  now: Date
): Omit<Prisma.SubscriptionCreateInput, "organization"> {
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  if (!isDevSubscriptionMode()) {
    return {
      status: "TRIAL",
      trialStartedAt: now,
      trialEndsAt,
      licencedUsers: PRICING_CONFIG.minimumUsers,
    };
  }

  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + DEV_PERIOD_YEARS);

  return {
    // A genuine ACTIVE subscription with every module attached — the same shape
    // approvePayment() produces for a real purchase, so every downstream check
    // sees an ordinary paid plan rather than a special case.
    status: "ACTIVE",
    // The trial window is closed immediately rather than left open. Both fields
    // are required, and computeEffectiveAccess tests `now < trialEndsAt` before
    // it looks at the paid period — leave the trial running and a dev org spends
    // its first days reported as a trial (banner and all) despite holding a
    // multi-year plan. Closing it makes the paid branch the one that answers.
    trialStartedAt: now,
    trialEndsAt: now,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    licencedUsers: DEV_LICENCED_USERS,
    modules: {
      create: ALL_MODULE_KEYS.map((module) => ({ module })),
    },
  };
}
