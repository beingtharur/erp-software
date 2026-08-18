import type { getQuotations } from "@/lib/queries/crm";
import { titleCase } from "@/lib/format";
import type { ExportColumn } from "@/lib/export/workbook";

export type QuotationRegisterRow = Awaited<ReturnType<typeof getQuotations>>[number];

// No single field answers "what was quoted" — a lead isn't required on a
// quotation. Prefer the linked lead's product line (a clean category) when
// one exists; otherwise fall back to the line items themselves, which are
// always present (creation is blocked without at least one).
function systemQuoted(row: QuotationRegisterRow): string {
  if (row.lead) return titleCase(row.lead.productLine);
  return row.lineItems.map((item) => item.description).join("; ");
}

export const quotationRegisterColumns: ExportColumn<QuotationRegisterRow>[] = [
  // A real field (Quotation.enquiryNumber), not an alias of quoteNumber —
  // an enquiry precedes a quotation in the client's own workflow, so the two
  // numbers are different documents and must not be conflated. Quotations
  // created before this field existed simply have no enquiry number; show
  // blank rather than falling back to quoteNumber.
  { header: "Enquiry No", value: (q) => q.enquiryNumber ?? "" },
  { header: "Date", value: (q) => q.issuedOn, numFmt: "dd-mmm-yyyy" },
  { header: "Client Name", value: (q) => q.client.name },
  { header: "Client Contact Person", value: (q) => q.client.contactName },
  { header: "System Quoted", value: (q) => systemQuoted(q) },
  { header: "Quoted Price", value: (q) => q.amount },
  { header: "Revision No", value: (q) => q.revision },
  { header: "Remark (If Any)", value: () => "" },
];
