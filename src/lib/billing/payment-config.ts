import "server-only";

// Central, env-based payment collection details — never hardcode these across
// components. Falls back to placeholder demo values so local/dev works without
// a .env; production deployments should always set these explicitly.
export const PAYMENT_CONFIG = {
  upiId: process.env.PAYMENT_UPI_ID ?? "existdigitally@upi",
  accountHolderName: process.env.PAYMENT_ACCOUNT_NAME ?? "Exist Digitally",
  bankName: process.env.PAYMENT_BANK_NAME ?? "HDFC Bank",
  accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER ?? "50100123456789",
  ifsc: process.env.PAYMENT_IFSC ?? "HDFC0000123",
} as const;

export function buildUpiDeepLink(params: { amount: number; referenceId: string }): string {
  const query = new URLSearchParams({
    pa: PAYMENT_CONFIG.upiId,
    pn: PAYMENT_CONFIG.accountHolderName,
    am: params.amount.toFixed(2),
    tr: params.referenceId,
    cu: "INR",
  });
  return `upi://pay?${query.toString()}`;
}
