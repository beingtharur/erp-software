import { notFound } from "next/navigation";
import Link from "next/link";
import { getQuotationDetail } from "@/lib/queries/crm";
import { getCurrentUser } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuotationStatusMenu } from "@/components/crm/quotation-status-menu";
import { formatDate, formatINR } from "@/lib/format";
import { FileText } from "lucide-react";

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
