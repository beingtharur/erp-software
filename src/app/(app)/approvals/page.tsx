import { getCurrentUser } from "@/lib/dal";
import { getPendingApprovals } from "@/lib/queries/approvals";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApprovalDecisionButtons } from "@/components/approvals/approval-decision-buttons";
import { formatDate, formatDateTime, formatINR, titleCase } from "@/lib/format";
import { ClipboardCheck } from "lucide-react";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  const approvals = await getPendingApprovals(user.accessRole, user.organizationId!);

  return (
    <>
      <SiteHeader title="Approvals" description="Requests waiting on your decision" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {approvals.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <ClipboardCheck className="size-6" />
              <p className="text-sm">Nothing waiting on you right now.</p>
            </CardContent>
          </Card>
        )}
        {approvals.map((approval) => (
          <Card key={approval.id}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {approval.purchaseOrder ? (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        Purchase Order {approval.purchaseOrder.poNumber}
                      </p>
                      <Badge variant="outline" className="font-normal">
                        {formatINR(approval.purchaseOrder.amount)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {approval.purchaseOrder.vendor.name} · {approval.purchaseOrder.itemsDescription}
                    </p>
                  </>
                ) : approval.expenseClaim ? (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Expense Claim {approval.expenseClaim.claimNumber}</p>
                      <Badge variant="outline" className="font-normal">
                        {formatINR(approval.expenseClaim.amount)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {titleCase(approval.expenseClaim.category)} · {approval.expenseClaim.description}
                    </p>
                  </>
                ) : approval.budget ? (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Budget · {approval.budget.department?.name ?? "—"}</p>
                      <Badge variant="outline" className="font-normal">
                        {formatINR(approval.budget.proposedAmount)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {titleCase(approval.budget.category)} · {formatDate(approval.budget.startDate)} –{" "}
                      {formatDate(approval.budget.endDate)}
                    </p>
                  </>
                ) : (
                  <p className="font-medium">{approval.entityType} · {approval.entityId}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Requested by {approval.requestedBy.name} · {formatDateTime(approval.createdAt)}
                  {approval.purchaseOrder && (
                    <> · Expected delivery {formatDate(approval.purchaseOrder.expectedDelivery)}</>
                  )}
                </p>
              </div>
              <ApprovalDecisionButtons approvalId={approval.id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
