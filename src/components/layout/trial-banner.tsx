import Link from "next/link";
import { Clock } from "lucide-react";
import type { EffectiveAccess } from "@/lib/billing/access";

export function TrialBanner({ access }: { access: EffectiveAccess }) {
  if (!access.isTrial) return null;

  const nearingExpiry = access.trialDaysRemaining <= 2;

  return (
    <div
      className={`flex items-center justify-center gap-2 border-b px-4 py-1.5 text-xs font-medium ${
        nearingExpiry
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-400"
      }`}
    >
      <Clock className="size-3.5" />
      {access.trialDaysRemaining > 0
        ? `${access.trialDaysRemaining} day${access.trialDaysRemaining === 1 ? "" : "s"} left in your free trial`
        : "Your free trial ends today"}
      <Link href="/subscription" className="underline underline-offset-2 hover:no-underline">
        View plans
      </Link>
    </div>
  );
}
