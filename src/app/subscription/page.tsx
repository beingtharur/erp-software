import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CheckCircle2, Clock, ShieldAlert, XCircle } from "lucide-react";
import { getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { computeEffectiveAccess } from "@/lib/billing/access";
import { navSections, roleHome } from "@/lib/nav";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";
import { PlanSelector } from "@/components/subscription/plan-selector";

export default async function SubscriptionStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string; m?: string }>;
}) {
  const { blocked, m } = await searchParams;
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();
  const access = computeEffectiveAccess(organization.subscription);
  const home = roleHome[user.accessRole] ?? "/";
  const blockedModuleTitle = navSections.find((s) => s.key === m)?.title;

  // TEMPORARY DEBUG — remove after confirming behavior on the live server.
  console.log("SUBSCRIPTION_DEBUG", {
    blocked,
    m,
    unlockedModules: access.unlockedModules,
    includesModule: access.unlockedModules.includes(m ?? ""),
  });

  // Self-heal stale/bookmarked "blocked" links: requireModuleAccess() only
  // ever generates this query string when the module is genuinely excluded
  // at redirect time, but access can change afterward (a subscription fix, a
  // plan upgrade) and the URL doesn't. Land on the clean status page instead
  // of showing a warning that's no longer true.
  if (blocked === "module" && m && access.unlockedModules.includes(m)) {
    redirect("/subscription");
  }

  // Mirrors requireModuleAccess()'s own check — the banner must reflect
  // current access, not just echo the query string back unconditionally.
  const isActuallyBlocked = blocked === "module" && Boolean(m) && !access.unlockedModules.includes(m ?? "");

  const statusMeta = access.isTrial
    ? { label: "Free trial", icon: Clock, tone: "text-blue-600 bg-blue-500/10" }
    : access.hasAccess
      ? { label: "Active", icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-500/10" }
      : { label: "No active access", icon: XCircle, tone: "text-destructive bg-destructive/10" };

  const StatusIcon = statusMeta.icon;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-6">
        <div className="flex items-center gap-3">
          <div className={`flex size-11 items-center justify-center rounded-full ${statusMeta.tone}`}>
            <StatusIcon className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{organization.name}</p>
            <h1 className="text-lg font-semibold">{statusMeta.label}</h1>
          </div>
        </div>

        {isActuallyBlocked && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              {blockedModuleTitle ?? "That module"} isn&apos;t included in your organization&apos;s current
              plan.
            </p>
          </div>
        )}

        {access.isTrial && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Your free trial includes full access to every module.
            </p>
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="size-4 text-muted-foreground" />
              {access.trialDaysRemaining > 0
                ? `${access.trialDaysRemaining} day${access.trialDaysRemaining === 1 ? "" : "s"} remaining · ends ${formatDate(organization.subscription!.trialEndsAt)}`
                : `Trial ends today`}
            </div>
          </div>
        )}

        {!access.isTrial && access.hasAccess && organization.subscription?.currentPeriodEnd && (
          <div className="space-y-1.5 text-sm">
            <p className="text-muted-foreground">
              Renews {formatDate(organization.subscription.currentPeriodEnd)} ·{" "}
              {organization.subscription.licencedUsers} user licences
            </p>
            <div className="flex flex-wrap gap-1.5">
              {access.unlockedModules.map((key) => {
                const section = navSections.find((s) => s.key === key);
                return (
                  <Badge key={key} variant="secondary" className="font-normal">
                    {section?.title ?? key}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {!access.hasAccess && (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {access.reason === "payment_pending"
                ? "Your payment has been submitted and is awaiting verification."
                : "Your organization doesn't have an active subscription."}
            </p>
            {access.reason !== "payment_pending" && (
              <p className="text-xs text-muted-foreground">
                {user.accessRole === "ADMIN"
                  ? "Use the plan calculator below to choose users and modules, then proceed to payment."
                  : "Contact your organization's admin to renew the subscription."}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          {access.hasAccess && (
            <Button nativeButton={false} render={<Link href={home} />}>
              Back to my dashboard
            </Button>
          )}
          <form action={logout}>
            <Button type="submit" variant="outline">
              Log out
            </Button>
          </form>
        </div>
      </div>

      {user.accessRole === "ADMIN" && (
        <div className="w-full max-w-md">
          <PlanSelector moduleOptions={navSections.map((s) => ({ key: s.key, title: s.title }))} />
        </div>
      )}
    </div>
  );
}
