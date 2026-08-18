import { getCurrentUser } from "@/lib/dal";
import { getProcurementQuotations, getProcurementQuotationVersions } from "@/lib/queries/procurement-quotations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, titleCase } from "@/lib/format";
import { NewQuotationSheet } from "@/components/vendors/new-quotation-sheet";
import { EditQuotationSheet } from "@/components/vendors/edit-quotation-sheet";
import { QuotationVersionSheet } from "@/components/vendors/quotation-version-sheet";
import { QuotationStatusMenu } from "@/components/vendors/quotation-status-menu";
import { QuotationFilters } from "@/components/vendors/quotation-filters";
import { DeleteQuotationButton } from "@/components/vendors/delete-quotation-button";
import { Paperclip, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ProcurementQuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const filters = await searchParams;
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const quotations = await getProcurementQuotations(organizationId, filters);
  const versionsByQuotation = await Promise.all(
    quotations.map((q) => getProcurementQuotationVersions(q.groupId, organizationId))
  );

  // Export what's on screen: the button carries the page's active filters, so
  // a filtered list and its download can never disagree.
  const exportParams = new URLSearchParams();
  if (filters.status && filters.status !== "ALL") exportParams.set("status", filters.status);
  if (filters.search) exportParams.set("search", filters.search);
  const exportQuery = exportParams.toString();
  const exportHref = `/api/exports/procurement-quotations${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <QuotationFilters />
        <div className="flex items-center gap-2">
          <Button variant="outline" nativeButton={false} render={<a href={exportHref} />}>
            <Download />
            Export to Excel
          </Button>
          <NewQuotationSheet />
        </div>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Uploaded by</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                  No quotations match these filters. Upload one above to get started.
                </TableCell>
              </TableRow>
            )}
            {quotations.map((q, i) => {
              const canEdit = user.accessRole === "ADMIN" || q.uploadedById === user.employeeId;
              return (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.quotationNumber}</TableCell>
                  <TableCell>{q.vendorName}</TableCell>
                  <TableCell className="text-muted-foreground">{q.projectName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{q.clientName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(q.quotationDate)}
                    {q.validUntil && (
                      <span className="block text-xs">until {formatDate(q.validUntil)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">v{q.version}</TableCell>
                  <TableCell className="text-muted-foreground">{q.uploadedBy.name}</TableCell>
                  <TableCell>
                    <a
                      href={q.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Paperclip className="size-3.5" />
                    </a>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <QuotationStatusMenu quotationId={q.id} status={q.status} />
                    ) : (
                      <span className="text-sm text-muted-foreground">{titleCase(q.status)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {canEdit && (
                        <>
                          <EditQuotationSheet quotation={q} />
                          <QuotationVersionSheet quotationId={q.id} versions={versionsByQuotation[i]} />
                        </>
                      )}
                      {user.accessRole === "ADMIN" && (
                        <DeleteQuotationButton groupId={q.groupId} quotationNumber={q.quotationNumber} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
