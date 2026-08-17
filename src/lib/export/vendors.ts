import type { getVendorsForExport } from "@/lib/queries/vendor";
import type { ExportColumn } from "@/lib/export/workbook";

export type VendorExportRow = Awaited<ReturnType<typeof getVendorsForExport>>[number];

export const vendorExportColumns: ExportColumn<VendorExportRow>[] = [
  { header: "Vendor Name", value: (v) => v.name },
  { header: "Category", value: (v) => v.category },
  { header: "Contact Person", value: (v) => v.contactName },
  { header: "Email", value: (v) => v.contactEmail },
  { header: "Phone", value: (v) => v.contactPhone },
  { header: "City", value: (v) => v.city },
  { header: "Rating", value: (v) => v.rating },
  { header: "Status", value: (v) => v.status },
  { header: "Purchase Orders", value: (v) => v._count.purchaseOrders },
  { header: "Payments", value: (v) => v._count.payments },
  { header: "Created Date", value: (v) => v.createdAt, numFmt: "dd-mmm-yyyy" },
];
