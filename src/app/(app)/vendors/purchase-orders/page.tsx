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
            </TableRow>
          </TableHeader>
          <TableBody>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
