// VendorPayment.status's OVERDUE value was previously only ever assigned once,
// at seed time (`isOverdue = !isPaid && dueDate < now`, computed then and never
// again) — a payment that goes past its due date after seeding stays PENDING
// forever, so every "Overdue" count/badge in the app was reading stale data.
// This recomputes it live on every read instead.
import type { PaymentStatus } from "@/generated/prisma/enums";

export function computeVendorPaymentStatus(
  payment: { status: PaymentStatus; dueDate: Date | string },
  now: Date = new Date()
): PaymentStatus {
  if (payment.status === "PAID") return "PAID";
  return new Date(payment.dueDate).getTime() < now.getTime() ? "OVERDUE" : "PENDING";
}
