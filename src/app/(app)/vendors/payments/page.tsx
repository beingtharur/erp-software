import { getVendorPayments } from "@/lib/queries/vendor";
import { getCurrentUser } from "@/lib/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatINR } from "@/lib/format";
import { ConfirmPaymentSheet } from "@/components/vendors/confirm-payment-sheet";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  PAID: "default",
  PENDING: "secondary",
  OVERDUE: "destructive",
};

export default async function VendorPaymentsPage() {
  const user = await getCurrentUser();
  const payments = await getVendorPayments(user.organizationId!);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor</TableHead>
            <TableHead>PO #</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Paid Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Status / Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                No payments yet. One is created automatically each time a purchase order is
                approved.
              </TableCell>
            </TableRow>
          )}
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.vendor.name}</TableCell>
              <TableCell className="text-muted-foreground">{p.purchaseOrder?.poNumber ?? "—"}</TableCell>
              <TableCell className="text-right font-mono">{formatINR(p.amount)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(p.dueDate)}</TableCell>
              <TableCell className="text-muted-foreground">
                {p.paidDate ? formatDate(p.paidDate) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{p.method ?? "—"}</TableCell>
              <TableCell className="text-right">
                {p.status === "PAID" ? (
                  <Badge variant={statusVariant[p.status]} className="font-normal">Paid</Badge>
                ) : p.awaitingConfirmation ? (
                  <Badge variant="secondary" className="font-normal">Awaiting confirmation</Badge>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <Badge variant={statusVariant[p.status]} className="font-normal">
                      {p.status === "OVERDUE" ? "Overdue" : "Pending"}
                    </Badge>
                    <ConfirmPaymentSheet paymentId={p.id} />
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
