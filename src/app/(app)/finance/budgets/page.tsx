import { getBudgets } from "@/lib/queries/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatINR, titleCase } from "@/lib/format";
import { NewBudgetSheet } from "@/components/finance/new-budget-sheet";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

export default async function BudgetsPage() {
  const budgets = await getBudgets();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <NewBudgetSheet />
      </div>

      {budgets.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No budgets proposed yet.
          </CardContent>
        </Card>
      )}

      {budgets.map((b) => {
        const utilization = b.proposedAmount > 0 ? Math.round((b.spent / b.proposedAmount) * 100) : 0;
        return (
          <Card key={b.id}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{b.department}</p>
                    <Badge variant="outline" className="font-normal">
                      {titleCase(b.category)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatDate(b.startDate)} – {formatDate(b.endDate)} · Requested by {b.requestedBy.name}
                  </p>
                </div>
                <Badge variant={statusVariant[b.status]} className="font-normal">
                  {titleCase(b.status)}
                </Badge>
              </div>

              {b.status === "APPROVED" && (
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatINR(b.spent)} of {formatINR(b.proposedAmount)} used
                    </span>
                    <span className="tabular-nums text-muted-foreground">{utilization}%</span>
                  </div>
                  <Progress value={Math.min(utilization, 100)} className="mt-1.5" />
                </div>
              )}

              {b.status !== "APPROVED" && (
                <p className="font-mono text-sm">{formatINR(b.proposedAmount)} proposed</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
