import type { Subscription, SubscriptionModule } from "@/generated/prisma/client";
import { navSections } from "@/lib/nav";

export const ALL_MODULE_KEYS = navSections.map((s) => s.key);

export function isModuleKey(value: string): value is (typeof ALL_MODULE_KEYS)[number] {
  return (ALL_MODULE_KEYS as string[]).includes(value);
}

export type SubscriptionWithModules = Subscription & { modules: SubscriptionModule[] };

export type EffectiveAccess = {
  hasAccess: boolean;
  isTrial: boolean;
  trialDaysRemaining: number;
  unlockedModules: string[];
  reason: "trial" | "active" | "payment_pending" | "subscription_expired" | "no_subscription";
};

// Access is always derived live from timestamps, never trusted from the stored
// `status` column alone — a TRIAL/ACTIVE row past its end date is expired even
// if nothing has run to flip the status yet.
export function computeEffectiveAccess(
  subscription: SubscriptionWithModules | null,
  now: Date = new Date()
): EffectiveAccess {
  if (!subscription) {
    return { hasAccess: false, isTrial: false, trialDaysRemaining: 0, unlockedModules: [], reason: "no_subscription" };
  }

  if (now < subscription.trialEndsAt) {
    const msRemaining = subscription.trialEndsAt.getTime() - now.getTime();
    const trialDaysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    return { hasAccess: true, isTrial: true, trialDaysRemaining, unlockedModules: ALL_MODULE_KEYS, reason: "trial" };
  }

  const inPaidPeriod = subscription.currentPeriodEnd !== null && now < subscription.currentPeriodEnd;
  if (inPaidPeriod && (subscription.status === "ACTIVE" || subscription.status === "CANCELLED")) {
    return {
      hasAccess: true,
      isTrial: false,
      trialDaysRemaining: 0,
      unlockedModules: subscription.modules.map((m) => m.module),
      reason: "active",
    };
  }

  if (subscription.status === "PAYMENT_PENDING") {
    return { hasAccess: false, isTrial: false, trialDaysRemaining: 0, unlockedModules: [], reason: "payment_pending" };
  }

  return { hasAccess: false, isTrial: false, trialDaysRemaining: 0, unlockedModules: [], reason: "subscription_expired" };
}
