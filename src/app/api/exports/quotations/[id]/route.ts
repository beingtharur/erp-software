import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getQuotationDetail } from "@/lib/queries/crm";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { quotationDocumentColumns } from "@/lib/export/quotation-document";
import { logExport } from "@/lib/export/audit";
import { formatDate, formatINR, titleCase } from "@/lib/format";

// Same access as /crm/quotations/[id], the page this mirrors — PROCUREMENT
// is included because Sachin's Quotations-only grant covers this page too.
// Reuses getQuotationDetail() and the exact figures the detail page shows
// (client, contact, dates, revision, status, line items, total) rather than
// re-deriving any of it.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "SALES", "PROCUREMENT"]);
  await requireModuleAccess("crm");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();
  const { id } = await params;

  const quotation = await getQuotationDetail(id, user.organizationId!);
  if (!quotation) {
    return new Response("Quotation not found", { status: 404 });
  }

  // Logged after the permission checks and the not-found check pass —
  // entityId is the quote number itself (see logExport), so the audit trail
  // says which quotation was downloaded, not just that "a" quotation was.
  await logExport({
    report: "quotation-document",
    organizationId: user.organizationId!,
    userId: user.id,
    entityId: quotation.quoteNumber,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: `Quotation ${quotation.quoteNumber}`,
    organizationName: organization.name,
    sheetName: "Quotation",
    columns: quotationDocumentColumns,
    rows: quotation.lineItems,
    extraHeaderLines: [
      // Shown even when blank so the customer-facing document always carries
      // the field: quotations predating Quotation.enquiryNumber have none,
      // and it must not fall back to quoteNumber (a different document).
      `Enquiry No: ${quotation.enquiryNumber ?? "—"}`,
      `Client: ${quotation.client.name}`,
      `Contact: ${quotation.client.contactName}`,
      `Issued: ${formatDate(quotation.issuedOn)}`,
      `Valid Until: ${formatDate(quotation.validUntil)}`,
      `Revision: ${quotation.revision}`,
      `Status: ${titleCase(quotation.status)}`,
    ],
    footerLines: [`Total: ${formatINR(quotation.amount)}`],
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename(quotation.quoteNumber.toLowerCase())}"`,
    },
  });
}
