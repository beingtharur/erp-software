import type { getProcurementQuotations } from "@/lib/queries/procurement-quotations";
import type { ExportColumn } from "@/lib/export/workbook";

export type ProcurementQuotationRow = Awaited<
  ReturnType<typeof getProcurementQuotations>
>[number];

// The client's 8 columns in their exact order, mapped to real
// ProcurementQuotation fields — nothing here is invented:
//
//   Enquiry No            -> quotationNumber (this model has no separate
//                            enquiryNumber; that field belongs to the CRM
//                            Quotation model and is a different document)
//   System Quoted         -> projectName, the nearest real field
//   Quoted Price          -> quotedPrice, captured manually at upload time
//                            because the figure lives inside the uploaded
//                            vendor file, which the app cannot read
//   Revision No           -> version (the list is latest-version rows only)
//
// Vendor Name is appended as a 9th column: it identifies who actually quoted,
// which is the defining fact of a procurement quotation and has no equivalent
// in the client's sales-side template. Drop this one entry if they want their
// screenshot format byte-for-byte.
export const procurementQuotationColumns: ExportColumn<ProcurementQuotationRow>[] = [
  { header: "Enquiry No", value: (q) => q.quotationNumber },
  { header: "Date", value: (q) => q.quotationDate, numFmt: "dd-mmm-yyyy" },
  { header: "Client Name", value: (q) => q.clientName ?? "" },
  { header: "Client Contact Person", value: (q) => q.clientContactPerson ?? "" },
  { header: "System Quoted", value: (q) => q.projectName ?? "" },
  // Blank rather than 0 when unset — 0 would read as "quoted at no charge",
  // and a total is never assumed for a document nobody priced.
  { header: "Quoted Price", value: (q) => q.quotedPrice ?? "" },
  { header: "Revision No", value: (q) => q.version },
  { header: "Remark", value: (q) => q.remarks ?? "" },
  { header: "Vendor Name", value: (q) => q.vendorName },
];
