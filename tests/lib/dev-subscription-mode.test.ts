import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildInitialSubscription, isDevSubscriptionMode } from "@/lib/billing/dev-mode";
import { computeEffectiveAccess, ALL_MODULE_KEYS } from "@/lib/billing/access";
import type { Subscription, SubscriptionModule } from "@/generated/prisma/client";

// Development mode must change *provisioning only*. These tests pin both
// halves of that promise: a dev-mode org really does get a full plan, and the
// access engine that grants it is the same unmodified one production uses.

const originalFlag = process.env.DEV_SUBSCRIPTION_MODE;

afterEach(() => {
  if (originalFlag === undefined) delete process.env.DEV_SUBSCRIPTION_MODE;
  else process.env.DEV_SUBSCRIPTION_MODE = originalFlag;
});

describe("isDevSubscriptionMode", () => {
  it("is off when the variable is unset — a forgotten env var can't hand out free plans", () => {
    delete process.env.DEV_SUBSCRIPTION_MODE;
    expect(isDevSubscriptionMode()).toBe(false);
  });

  it("is off for anything other than the exact string 'true'", () => {
    for (const value of ["false", "1", "yes", "TRUE", ""]) {
      process.env.DEV_SUBSCRIPTION_MODE = value;
      expect(isDevSubscriptionMode()).toBe(false);
    }
  });

  it("is on only for 'true'", () => {
    process.env.DEV_SUBSCRIPTION_MODE = "true";
    expect(isDevSubscriptionMode()).toBe(true);
  });
});

const NOW = new Date("2026-08-05T10:00:00.000Z");

describe("buildInitialSubscription with development mode off", () => {
  beforeEach(() => {
    process.env.DEV_SUBSCRIPTION_MODE = "false";
  });

  it("provisions the normal 5-day trial with no modules attached", () => {
    const sub = buildInitialSubscription(NOW);
    expect(sub.status).toBe("TRIAL");
    expect(sub.licencedUsers).toBe(5);
    expect(sub.currentPeriodEnd).toBeUndefined();
    expect(sub.modules).toBeUndefined();
    const days = (new Date(sub.trialEndsAt as Date).getTime() - NOW.getTime()) / 86400000;
    expect(days).toBe(5);
  });

  it("expires after the trial, exactly as before", () => {
    const sub = buildInitialSubscription(NOW);
    const stored = { ...sub, modules: [] } as unknown as Subscription & {
      modules: SubscriptionModule[];
    };
    const afterTrial = new Date(NOW.getTime() + 6 * 86400000);
    expect(computeEffectiveAccess(stored, afterTrial).hasAccess).toBe(false);
    expect(computeEffectiveAccess(stored, afterTrial).reason).toBe("subscription_expired");
  });
});

describe("buildInitialSubscription with development mode on", () => {
  beforeEach(() => {
    process.env.DEV_SUBSCRIPTION_MODE = "true";
  });

  it("provisions a real ACTIVE plan with every module", () => {
    const sub = buildInitialSubscription(NOW);
    expect(sub.status).toBe("ACTIVE");
    expect(sub.licencedUsers).toBeGreaterThanOrEqual(100);
    expect(sub.currentPeriodEnd).toBeInstanceOf(Date);
    const created = (sub.modules as { create: { module: string }[] }).create.map((m) => m.module);
    expect(created.sort()).toEqual([...ALL_MODULE_KEYS].sort());
  });

  it("closes the trial window so the org reads as paid from day one, not as a trial", () => {
    const sub = buildInitialSubscription(NOW);
    const stored = {
      ...sub,
      modules: (sub.modules as { create: { module: string }[] }).create,
    } as unknown as Subscription & { modules: SubscriptionModule[] };

    // One minute after signup — the moment a real tester would look at it.
    const access = computeEffectiveAccess(stored, new Date(NOW.getTime() + 60_000));
    expect(access.isTrial).toBe(false);
    expect(access.reason).toBe("active");
    expect(access.trialDaysRemaining).toBe(0);
  });

  it("grants access through the ordinary access engine, not a bypass", () => {
    const sub = buildInitialSubscription(NOW);
    const stored = {
      ...sub,
      modules: (sub.modules as { create: { module: string }[] }).create,
    } as unknown as Subscription & { modules: SubscriptionModule[] };

    // Well past the trial window — access has to come from the paid period.
    const later = new Date(NOW.getTime() + 400 * 86400000);
    const access = computeEffectiveAccess(stored, later);
    expect(access.hasAccess).toBe(true);
    expect(access.isTrial).toBe(false);
    expect(access.reason).toBe("active");
    expect(access.unlockedModules.sort()).toEqual([...ALL_MODULE_KEYS].sort());
  });

  it("still expires once the provisioned period ends — nothing is unconditional", () => {
    const sub = buildInitialSubscription(NOW);
    const stored = {
      ...sub,
      modules: (sub.modules as { create: { module: string }[] }).create,
    } as unknown as Subscription & { modules: SubscriptionModule[] };

    const afterPeriod = new Date((sub.currentPeriodEnd as Date).getTime() + 86400000);
    expect(computeEffectiveAccess(stored, afterPeriod).hasAccess).toBe(false);
  });

  it("turning the flag back off restores trial provisioning immediately", () => {
    expect(buildInitialSubscription(NOW).status).toBe("ACTIVE");
    process.env.DEV_SUBSCRIPTION_MODE = "false";
    expect(buildInitialSubscription(NOW).status).toBe("TRIAL");
  });
});
