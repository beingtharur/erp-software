import type { getQuotationDetail } from "@/lib/queries/crm";
import type { ExportColumn } from "@/lib/export/workbook";

type QuotationDetail = NonNullable<Awaited<ReturnType<typeof getQuotationDetail>>>;
export type QuotationLineItemRow = QuotationDetail["lineItems"][number];

export const quotationDocumentColumns: ExportColumn<QuotationLineItemRow>[] = [
  { header: "Description", value: (item) => item.description },
  { header: "Quantity", value: (item) => item.quantity },
  { header: "Unit Price", value: (item) => item.unitPrice },
  { header: "Amount", value: (item) => item.amount },
];
