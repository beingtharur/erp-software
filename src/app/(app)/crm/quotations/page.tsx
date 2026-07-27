import Link from "next/link";
import { getQuotations, getClientOptions, getLeadOptionsByClient } from "@/lib/queries/crm";
import { getCurrentUser } from "@/lib/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatINR } from "@/lib/format";
import { QuotationStatusMenu } from "@/components/crm/quotation-status-menu";
import { NewQuotationSheet } from "@/components/crm/new-quotation-sheet";

export default async function QuotationsPage() {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [quotations, clients, leads] = await Promise.all([
    getQuotations(organizationId),
    getClientOptions(organizationId),
    getLeadOptionsByClient(organizationId),
  ]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <NewQuotationSheet clients={clients} leads={leads} />
      </div>
      <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quote #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Related Lead</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Rev.</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead>Valid Until</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotations.map((q) => (
            <TableRow key={q.id}>
              <TableCell className="font-medium">
                <Link href={`/crm/quotations/${q.id}`} className="hover:underline">
                  {q.quoteNumber}
                </Link>
              </TableCell>
              <TableCell>{q.client.name}</TableCell>
              <TableCell className="max-w-56 truncate text-muted-foreground">
                {q.lead?.title ?? "—"}
              </TableCell>
              <TableCell className="text-right font-mono">{formatINR(q.amount)}</TableCell>
              <TableCell className="text-right text-muted-foreground">R{q.revision}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(q.issuedOn)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(q.validUntil)}</TableCell>
              <TableCell>
                <QuotationStatusMenu quotationId={q.id} status={q.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
