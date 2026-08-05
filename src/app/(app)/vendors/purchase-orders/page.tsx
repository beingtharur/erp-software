import { getPurchaseOrders, getVendorOptions } from "@/lib/queries/vendor";
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
import { formatDate, formatINR, titleCase } from "@/lib/format";
import { NewPurchaseOrderSheet } from "@/components/vendors/new-po-sheet";
import { EditPurchaseOrderSheet } from "@/components/vendors/edit-po-sheet";
import { DeletePoButton, ReorderPoButton, CancelPoButton } from "@/components/vendors/po-row-actions";
import { isValidTransition, PO_STATUS_TRANSITIONS, type PoStatus } from "@/lib/status-transitions";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  SENT: "secondary",
  CONFIRMED: "secondary",
  DELIVERED: "default",
  CANCELLED: "destructive",
};

export default async function PurchaseOrdersPage() {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [orders, vendors] = await Promise.all([
    getPurchaseOrders(organizationId),
    getVendorOptions(organizationId),
  ]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <NewPurchaseOrderSheet vendors={vendors} />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Expected Delivery</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  No purchase orders yet. Raise one above — it goes to an admin for approval before
                  it&apos;s sent.
                </TableCell>
              </TableRow>
            )}
            {orders.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium">{po.poNumber}</TableCell>
                <TableCell>{po.vendor.name}</TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">
                  {po.itemsDescription}
                </TableCell>
                <TableCell className="text-right font-mono">{formatINR(po.amount)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(po.orderDate)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(po.expectedDelivery)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[po.status]} className="font-normal">
                    {titleCase(po.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {po.status === "DRAFT" && <EditPurchaseOrderSheet po={po} vendors={vendors} />}
                    {isValidTransition(PO_STATUS_TRANSITIONS, po.status as PoStatus, "CANCELLED") && (
                      <CancelPoButton poId={po.id} poNumber={po.poNumber} />
                    )}
                    <ReorderPoButton poId={po.id} />
                    <DeletePoButton poId={po.id} poNumber={po.poNumber} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
