import { notFound } from "next/navigation";
import Link from "next/link";
import { getQuotationDetail } from "@/lib/queries/crm";
import { getCurrentUser } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuotationStatusMenu } from "@/components/crm/quotation-status-menu";
import { ConvertToProjectSheet } from "@/components/crm/convert-to-project-sheet";
import { formatDate, formatINR } from "@/lib/format";
import { FileText, HardHat } from "lucide-react";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const quotation = await getQuotationDetail(id, user.organizationId!);

  if (!quotation) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{quotation.quoteNumber}</h2>
                <QuotationStatusMenu quotationId={quotation.id} status={quotation.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                <Link href={`/crm/clients/${quotation.clientId}`} className="hover:underline">
                  {quotation.client.name}
                </Link>
                {quotation.lead ? ` · ${quotation.lead.title}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:items-end">
            <span>Issued {formatDate(quotation.issuedOn)}</span>
            <span>Valid until {formatDate(quotation.validUntil)}</span>
            <span>Revision {quotation.revision}</span>
          </div>
        </CardContent>
      </Card>

      {quotation.project ? (
        <Card>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <HardHat className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Converted Project</p>
                <p className="text-sm font-medium">{quotation.project.name}</p>
              </div>
            </div>
            <Link
              href={`/crm/projects/${quotation.project.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Open Project →
            </Link>
          </CardContent>
        </Card>
      ) : quotation.status === "APPROVED" ? (
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ready to convert</p>
              <p className="text-xs text-muted-foreground">
                This quotation is approved — turn it into a project.
              </p>
            </div>
            <ConvertToProjectSheet
              quotationId={quotation.id}
              suggestedName={`${quotation.client.name} — ${quotation.quoteNumber}`}
              suggestedProductLine={quotation.lead?.productLine}
              amount={quotation.amount}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Line items</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {quotation.lineItems.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">
              No line items on this quotation (seeded before line items existed).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotation.lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatINR(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatINR(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex items-center justify-end gap-3 border-t px-6 pt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-mono text-base font-semibold">{formatINR(quotation.amount)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
