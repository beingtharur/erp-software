import { getExpenseClaims } from "@/lib/queries/finance";
import { getCurrentUser } from "@/lib/dal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatINR, titleCase } from "@/lib/format";
import { ReimburseClaimButton } from "@/components/finance/reimburse-claim-button";
import { DecideClaimButtons } from "@/components/finance/decide-claim-buttons";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  REIMBURSED: "outline",
};

export default async function ExpenseClaimsPage() {
  const user = await getCurrentUser();
  const claims = await getExpenseClaims(user.organizationId!);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Claim #</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {claims.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                No expense claims yet.
              </TableCell>
            </TableRow>
          )}
          {claims.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.claimNumber}</TableCell>
              <TableCell>{c.employee.name}</TableCell>
              <TableCell className="text-muted-foreground">{titleCase(c.category)}</TableCell>
              <TableCell className="max-w-56 truncate text-muted-foreground">{c.description}</TableCell>
              <TableCell className="text-right font-mono">{formatINR(c.amount)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(c.expenseDate)}</TableCell>
              <TableCell className="text-right">
                {c.status === "APPROVED" ? (
                  <div className="flex justify-end">
                    <ReimburseClaimButton claimId={c.id} />
                  </div>
                ) : c.status === "PENDING" && c.approvalId ? (
                  <DecideClaimButtons approvalId={c.approvalId} />
                ) : (
                  <Badge variant={statusVariant[c.status]} className="font-normal">
                    {titleCase(c.status)}
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
