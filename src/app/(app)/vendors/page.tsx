import Link from "next/link";
import { getVendors } from "@/lib/queries/vendor";
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
import { NewVendorSheet } from "@/components/vendors/new-vendor-sheet";
import { VendorRatingControl } from "@/components/vendors/vendor-rating-control";
import { DeleteVendorButton } from "@/components/vendors/vendor-row-actions";

export default async function VendorsPage() {
  const user = await getCurrentUser();
  const vendors = await getVendors(user.organizationId!);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <NewVendorSheet />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="text-right">Purchase Orders</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  <Link href={`/vendors/${v.id}`} className="hover:underline">
                    {v.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{v.category}</TableCell>
                <TableCell className="text-muted-foreground">{v.city}</TableCell>
                <TableCell className="text-muted-foreground">{v.contactName}</TableCell>
                <TableCell>
                  <VendorRatingControl vendorId={v.id} rating={v.rating} readOnly />
                </TableCell>
                <TableCell className="text-right">{v._count.purchaseOrders}</TableCell>
                <TableCell>
                  <Badge className="font-normal">{v.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <DeleteVendorButton vendorId={v.id} vendorName={v.name} />
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
