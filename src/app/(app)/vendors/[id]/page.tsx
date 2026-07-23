import { notFound } from "next/navigation";
import { getVendorDetail } from "@/lib/queries/vendor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VendorRatingControl } from "@/components/vendors/vendor-rating-control";
import { formatDate, formatINR, titleCase } from "@/lib/format";
import { Mail, Phone, MapPin, Truck } from "lucide-react";

const poStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  SENT: "secondary",
  CONFIRMED: "secondary",
  DELIVERED: "default",
  CANCELLED: "destructive",
};

const paymentStatusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  PAID: "default",
  PENDING: "secondary",
  OVERDUE: "destructive",
};

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vendor = await getVendorDetail(id);

  if (!vendor) notFound();

  const totalSpend = vendor.purchaseOrders
    .filter((po) => po.status !== "CANCELLED" && po.status !== "DRAFT")
    .reduce((sum, po) => sum + po.amount, 0);
  const deliveredCount = vendor.purchaseOrders.filter((po) => po.status === "DELIVERED").length;
  const overduePayments = vendor.payments.filter((p) => p.status === "OVERDUE");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Truck className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{vendor.name}</h2>
                <Badge variant="outline" className="font-normal">{vendor.category}</Badge>
                <Badge
                  variant={vendor.status === "Active" ? "default" : "secondary"}
                  className="font-normal"
                >
                  {vendor.status}
                </Badge>
              </div>
              <div className="mt-1">
                <VendorRatingControl vendorId={vendor.id} rating={vendor.rating} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:items-end">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" /> {vendor.city}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" /> {vendor.contactEmail}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" /> {vendor.contactPhone}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Total Spend</p>
            <p className="text-xl font-semibold">{formatINR(totalSpend)}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Purchase Orders</p>
            <p className="text-xl font-semibold">{vendor.purchaseOrders.length}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Delivered</p>
            <p className="text-xl font-semibold">{deliveredCount}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Overdue Payments</p>
            <p className={"text-xl font-semibold" + (overduePayments.length > 0 ? " text-destructive" : "")}>
              {overduePayments.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Purchase Order History</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {vendor.purchaseOrders.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">No purchase orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendor.purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.poNumber}</TableCell>
                      <TableCell className="max-w-56 truncate text-muted-foreground">
                        {po.itemsDescription}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatINR(po.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(po.orderDate)}</TableCell>
                      <TableCell>
                        <Badge variant={poStatusVariant[po.status]} className="font-normal">
                          {titleCase(po.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {vendor.payments.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendor.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">{p.purchaseOrder?.poNumber ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{formatINR(p.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.dueDate)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.paidDate ? formatDate(p.paidDate) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={paymentStatusVariant[p.status]} className="font-normal">
                          {titleCase(p.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
