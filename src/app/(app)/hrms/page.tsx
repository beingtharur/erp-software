import Link from "next/link";
import { getHrmsOverview } from "@/lib/queries/hrms";
import { getCurrentUser } from "@/lib/dal";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LeaveDecisionButtons } from "@/components/hrms/leave-decision-buttons";
import { formatDate, initials, titleCase } from "@/lib/format";
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
  const data = await getHrmsOverview(user.organizationId!);

  const attendanceMap = Object.fromEntries(
    data.attendanceToday.map((a) => [a.status, a._count])
  );
  const present = attendanceMap["PRESENT"] ?? 0;
  const halfDay = attendanceMap["HALF_DAY"] ?? 0;
  const absent = attendanceMap["ABSENT"] ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
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
          <CardHeader>
            <CardTitle>Headcount by department</CardTitle>
            <CardDescription>Active employees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.departmentCounts
              .sort((a, b) => b._count - a._count)
              .map((d) => (
                <div key={d.department} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{d.department}</span>
                  <Badge variant="secondary" className="font-normal">{d._count}</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
