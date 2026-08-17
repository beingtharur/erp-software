import { getExpenseClaims } from "@/lib/queries/finance";
import { getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, formatINR, titleCase } from "@/lib/format";
import { ReimburseClaimButton } from "@/components/finance/reimburse-claim-button";
import { DecideClaimButtons } from "@/components/finance/decide-claim-buttons";
import { ExpenseClaimFilters } from "@/components/finance/expense-claim-filters";
import { ExpenseApproverSetting } from "@/components/finance/expense-approver-setting";
import { Paperclip } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  REIMBURSED: "outline",
};

export default async function ExpenseClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const filters = await searchParams;
  const user = await getCurrentUser();
  const [claims, organization] = await Promise.all([
    getExpenseClaims(user.organizationId!, filters),
    getCurrentOrganization(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ExpenseClaimFilters />
        {user.accessRole === "ADMIN" && (
          <ExpenseApproverSetting current={organization.expenseApproverRole} />
        )}
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim #</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Docs</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                  No expense claims match these filters.
                </TableCell>
              </TableRow>
            )}
            {claims.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.claimNumber}</TableCell>
                <TableCell>{c.employee.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.employee.department?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{titleCase(c.category)}</TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">{c.description}</TableCell>
                <TableCell className="text-right font-mono">{formatINR(c.amount)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(c.expenseDate)}</TableCell>
                <TableCell>
                  {c.attachments.length > 0 ? (
                    <a
                      href={c.attachments[0].fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Paperclip className="size-3.5" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {c.status === "APPROVED" ? (
                    <div className="flex flex-col items-end gap-1">
                      <ReimburseClaimButton claimId={c.id} />
                      {c.decidedByName && (
                        <span className="text-xs text-muted-foreground">by {c.decidedByName}</span>
                      )}
                    </div>
                  ) : c.status === "PENDING" && c.approvalId ? (
                    <div className="flex flex-col items-end gap-1">
                      <DecideClaimButtons approvalId={c.approvalId} />
                      {c.approverRole && (
                        <span className="text-xs text-muted-foreground">
                          Routed to {titleCase(c.approverRole)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={statusVariant[c.status]} className="font-normal">
                        {titleCase(c.status)}
                      </Badge>
                      {c.decidedByName && c.decidedOn && (
                        <span className="text-xs text-muted-foreground">
                          by {c.decidedByName} · {formatDateTime(c.decidedOn)}
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
