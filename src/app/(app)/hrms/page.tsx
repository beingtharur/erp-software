import Link from "next/link";
import { getHrmsOverview } from "@/lib/queries/hrms";
import { getCurrentUser } from "@/lib/dal";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LeaveDecisionButtons } from "@/components/hrms/leave-decision-buttons";
import { DecideClaimButtons } from "@/components/finance/decide-claim-buttons";
import { formatDate, formatINR, initials, titleCase } from "@/lib/format";
import {
  Users,
  UserCheck,
  Plane,
  CalendarOff,
  Wallet,
  ListChecks,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export default async function HrmsOverviewPage() {
  const user = await getCurrentUser();
  const data = await getHrmsOverview(user.organizationId!, user.accessRole);

  const attendanceMap = Object.fromEntries(
    data.attendanceToday.map((a) => [a.status, a._count])
  );
  const present = attendanceMap["PRESENT"] ?? 0;
  const halfDay = attendanceMap["HALF_DAY"] ?? 0;
  const absent = attendanceMap["ABSENT"] ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Active Employees" value={String(data.totalActive)} icon={Users} />
        <KpiCard
          label="Present Today"
          value={String(present)}
          sub={`${halfDay} half-day`}
          icon={UserCheck}
          tone="success"
        />
        <KpiCard label="Absent Today" value={String(absent)} icon={CalendarOff} tone={absent > 0 ? "warning" : "default"} />
        <KpiCard
          label="On Leave Today"
          value={String(data.onLeaveToday)}
          icon={Plane}
        />
        <KpiCard
          label="Pending Half-Day"
          value={String(data.pendingHalfDay)}
          sub="awaiting approval"
          icon={Clock}
          tone={data.pendingHalfDay > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Pending Payroll"
          value={String(data.pendingPayroll)}
          sub="this month"
          icon={Wallet}
          tone={data.pendingPayroll > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Total Tasks"
          value={String(data.taskStats.total)}
          sub="across the org"
          icon={ListChecks}
        />
        <KpiCard
          label="Pending Tasks"
          value={String(data.taskStats.pending)}
          icon={Clock}
          tone={data.taskStats.pending > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Overdue Tasks"
          value={String(data.taskStats.overdue)}
          icon={AlertTriangle}
          tone={data.taskStats.overdue > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Completed Today"
          value={String(data.taskStats.completedToday)}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pending leave requests</CardTitle>
            <CardDescription>
              Awaiting HR approval
              {data.pendingLeave > 0 && ` · ${data.pendingLeave} total`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentLeaveRequests.length === 0 && (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            )}
            {data.recentLeaveRequests.map((leave) => (
              <div
                key={leave.id}
                className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{initials(leave.employee.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{leave.employee.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {titleCase(leave.type)} · {formatDate(leave.startDate)} – {formatDate(leave.endDate)} ({leave.days}d)
                    </p>
                  </div>
                </div>
                <LeaveDecisionButtons leaveId={leave.id} />
              </div>
            ))}
            {data.pendingLeave > data.recentLeaveRequests.length && (
              <Link
                href="/hrms/leave"
                className="block pt-1 text-sm font-medium text-primary hover:underline"
              >
                View all {data.pendingLeave} pending requests →
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Headcount by department</CardTitle>
              <CardDescription>Active employees</CardDescription>
            </div>
            <Link
              href="/hrms/departments"
              className="text-xs font-medium text-primary hover:underline"
            >
              Manage →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.departmentHeadcount.departments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No departments yet.{" "}
                <Link href="/hrms/departments" className="font-medium text-primary hover:underline">
                  Set them up
                </Link>{" "}
                to organize your team.
              </p>
            )}
            {[...data.departmentHeadcount.departments]
              .sort((a, b) => b.count - a.count)
              .map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {d.name}
                    {!d.isActive && (
                      <span className="ml-1.5 text-xs text-muted-foreground/70">(inactive)</span>
                    )}
                  </span>
                  <Badge variant="secondary" className="font-normal">
                    {d.count}
                  </Badge>
                </div>
              ))}
            {data.departmentHeadcount.unassigned > 0 && (
              <div className="flex items-center justify-between border-t pt-2.5 text-sm">
                <span className="text-muted-foreground">No department assigned</span>
                <Badge variant="outline" className="font-normal">
                  {data.departmentHeadcount.unassigned}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending expense claims</CardTitle>
          <CardDescription>
            Travel & other reimbursement requests — visible here regardless of who&apos;s configured to
            decide them
            {data.pendingExpenseClaims.total > 0 && ` · ${data.pendingExpenseClaims.total} total`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.pendingExpenseClaims.claims.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending claims.</p>
          )}
          {data.pendingExpenseClaims.claims.map((claim) => (
            <div
              key={claim.id}
              className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">{initials(claim.employee.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{claim.employee.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {titleCase(claim.category)} · {claim.employee.department?.name ?? "—"} ·{" "}
                    {formatINR(claim.amount)} · {formatDate(claim.expenseDate)}
                  </p>
                </div>
              </div>
              {claim.canDecide && claim.approvalId ? (
                <DecideClaimButtons approvalId={claim.approvalId} />
              ) : (
                <Badge variant="secondary" className="shrink-0 font-normal">
                  View only
                </Badge>
              )}
            </div>
          ))}
          {data.pendingExpenseClaims.total > data.pendingExpenseClaims.claims.length && (
            <Link href="/approvals" className="block pt-1 text-sm font-medium text-primary hover:underline">
              View all {data.pendingExpenseClaims.total} pending claims →
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
