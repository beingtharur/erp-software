import { getPayments } from "@/lib/queries/platform-admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { navSections } from "@/lib/nav";
import { PaymentReviewActions } from "@/components/platform-admin/payment-review-actions";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  REFUNDED: "outline",
};

function moduleTitles(modulesJson: string) {
  const keys: string[] = JSON.parse(modulesJson);
  return keys.map((k) => navSections.find((s) => s.key === k)?.title ?? k).join(", ");
}

export default async function PlatformAdminPaymentsPage() {
  const payments = await getPayments();
  const pending = payments.filter((p) => p.status === "PENDING");
  const reviewed = payments.filter((p) => p.status !== "PENDING");

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">
          Pending verification {pending.length > 0 && `(${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting on review.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>UTR</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Payment date</TableHead>
                  <TableHead>Screenshot</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.organization.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.submittedBy.employee?.name ?? p.submittedBy.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.numUsers} users · {moduleTitles(p.modules)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatINR(p.amount)}</TableCell>
                    <TableCell className="font-mono text-xs">{p.utr}</TableCell>
                    <TableCell className="text-muted-foreground">{p.method}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.paymentDate)}</TableCell>
                    <TableCell>
                      {p.screenshotUrl ? (
                        <a
                          href={p.screenshotUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <PaymentReviewActions paymentId={p.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Payment history</h2>
        {reviewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviewed payments yet.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>UTR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.organization.name}</TableCell>
                    <TableCell className="text-right font-mono">{formatINR(p.amount)}</TableCell>
                    <TableCell className="font-mono text-xs">{p.utr}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[p.status]} className="font-normal">
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.reviewedAt ? formatDateTime(p.reviewedAt) : "—"}
                      {p.reviewedBy && ` · ${p.reviewedBy.employee?.name ?? p.reviewedBy.email}`}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.rejectionReason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
