import QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, getCurrentOrganization, requireRole } from "@/lib/dal";
import { calculatePrice, PRICING_CONFIG } from "@/lib/billing/pricing-config";
import { PAYMENT_CONFIG, buildUpiDeepLink } from "@/lib/billing/payment-config";
import { ALL_MODULE_KEYS, isModuleKey } from "@/lib/billing/access";
import { navSections } from "@/lib/nav";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PaymentSubmissionForm } from "@/components/subscription/payment-submission-form";

export default async function SubscriptionPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ numUsers?: string; modules?: string }>;
}) {
  await requireRole(["ADMIN"]);
  await getCurrentUser();
  const organization = await getCurrentOrganization();

  const { numUsers: numUsersRaw, modules: modulesRaw } = await searchParams;
  const numUsers = Math.max(PRICING_CONFIG.minimumUsers, Number(numUsersRaw) || PRICING_CONFIG.minimumUsers);
  const modules = (modulesRaw?.split(",") ?? ALL_MODULE_KEYS).filter(isModuleKey);
  const effectiveModules = modules.length > 0 ? modules : ALL_MODULE_KEYS;

  const price = calculatePrice(numUsers, effectiveModules);
  const referenceId = `${organization.slug.toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const upiLink = buildUpiDeepLink({ amount: price.finalPrice, referenceId });
  const qrDataUrl = await QRCode.toDataURL(upiLink, { margin: 1, width: 240 });

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-4 py-10">
      <Link href="/subscription" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to subscription
      </Link>

      <div className="rounded-lg border p-6">
        <h1 className="text-lg font-semibold">Complete your payment</h1>
        <p className="text-sm text-muted-foreground">
          {numUsers} users ·{" "}
          {effectiveModules.map((key) => navSections.find((s) => s.key === key)?.title ?? key).join(", ")}
        </p>

        <div className="mt-4 grid gap-6 sm:grid-cols-[240px_1fr]">
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="UPI payment QR code" className="size-[240px] rounded-md border" />
            <p className="text-xs text-muted-foreground">Scan with any UPI app</p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Amount payable</span>
              <span className="text-base font-semibold">{formatINR(price.finalPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">UPI ID</span>
              <span className="font-mono">{PAYMENT_CONFIG.upiId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account name</span>
              <span>{PAYMENT_CONFIG.accountHolderName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank</span>
              <span>{PAYMENT_CONFIG.bankName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account number</span>
              <span className="font-mono">{PAYMENT_CONFIG.accountNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IFSC</span>
              <span className="font-mono">{PAYMENT_CONFIG.ifsc}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono">{referenceId}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Add the reference above as a note/remark on your UPI or bank transfer — it helps us
              match your payment faster. After paying, submit the confirmation below; a team
              member will verify and activate your subscription.
            </p>
          </div>
        </div>
      </div>

      <PaymentSubmissionForm numUsers={numUsers} modules={effectiveModules} />

      <p className="text-center text-xs text-muted-foreground">
        <Button nativeButton={false} variant="link" size="xs" render={<Link href="/subscription" />}>
          Cancel and go back
        </Button>
      </p>
    </div>
  );
}
