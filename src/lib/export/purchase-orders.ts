import type { getPurchaseOrdersForExport } from "@/lib/queries/vendor";
import { titleCase } from "@/lib/format";
import type { ExportColumn } from "@/lib/export/workbook";

export type PurchaseOrderExportRow = Awaited<ReturnType<typeof getPurchaseOrdersForExport>>[number];

export const purchaseOrderExportColumns: ExportColumn<PurchaseOrderExportRow>[] = [
  { header: "PO Number", value: (po) => po.poNumber },
  { header: "Vendor Name", value: (po) => po.vendor.name },
  { header: "Items Description", value: (po) => po.itemsDescription },
  { header: "Amount", value: (po) => po.amount },
  { header: "Order Date", value: (po) => po.orderDate, numFmt: "dd-mmm-yyyy" },
  { header: "Expected Delivery", value: (po) => po.expectedDelivery, numFmt: "dd-mmm-yyyy" },
  { header: "Status", value: (po) => titleCase(po.status) },
];
