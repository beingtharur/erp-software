import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { ArrowRight, ListChecks } from "lucide-react";
import type { getEmployeeTaskSummary } from "@/lib/queries/tasks";

type Summary = Awaited<ReturnType<typeof getEmployeeTaskSummary>>;

/**
 * The employee's at-a-glance task card for /me — where they land. Reads from
 * the same getEmployeeTaskSummary their HRMS profile uses, so what they see
 * here and what HR sees there can never drift. Purely a surface: all the real
 * work happens on /me/tasks.
 */
export function TaskSummaryCard({ summary }: { summary: Summary }) {
  const { pending, overdue, dueToday, recentAssignments } = summary;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListChecks className="size-4 text-muted-foreground" />
            My Tasks
          </CardTitle>
          <CardDescription>Assigned to you by HR, your manager, or yourself</CardDescription>
        </div>
        <Button
          nativeButton={false}
          size="sm"
          variant="outline"
          render={<Link href="/me/tasks" />}
        >
          Open My Tasks
          <ArrowRight data-icon="inline-end" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <Link href="/me/tasks" className="rounded-lg border p-3 transition-colors hover:bg-muted">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-semibold tabular-nums">{pending}</p>
          </Link>
          <Link href="/me/tasks" className="rounded-lg border p-3 transition-colors hover:bg-muted">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p
              className={`text-xl font-semibold tabular-nums ${
                overdue > 0 ? "text-destructive" : ""
              }`}
            >
              {overdue}
            </p>
          </Link>
          <Link href="/me/tasks" className="rounded-lg border p-3 transition-colors hover:bg-muted">
            <p className="text-xs text-muted-foreground">Due today</p>
            <p
              className={`text-xl font-semibold tabular-nums ${dueToday > 0 ? "text-amber-600" : ""}`}
            >
              {dueToday}
            </p>
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Recent assignments</p>
          {recentAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing assigned to you yet — anything HR or your manager sends over shows up here.
            </p>
          ) : (
            recentAssignments.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    From {task.assignedBy?.name ?? "your manager"}
                    {task.dueDate ? ` · Due ${formatDate(task.dueDate)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {task.isBlocked && (
                    <Badge variant="destructive" className="font-normal">
                      Blocked
                    </Badge>
                  )}
                  <Badge
                    variant={
                      task.status === "DONE"
                        ? "default"
                        : task.status === "IN_PROGRESS"
                          ? "secondary"
                          : "outline"
                    }
                    className="font-normal"
                  >
                    {task.status === "IN_PROGRESS"
                      ? "In Progress"
                      : task.status === "DONE"
                        ? "Done"
                        : "To Do"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
