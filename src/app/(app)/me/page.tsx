import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/dal";
import {
  getMyAttendance,
  getMyLeaveRequests,
  getMyTimesheets,
  getMyTasks,
  getProjectOptions,
} from "@/lib/queries/me";
import { getMyExpenseClaims } from "@/lib/queries/finance";
import { formatDate, formatINR, initials, titleCase } from "@/lib/format";
import { ApplyLeaveSheet } from "@/components/me/apply-leave-sheet";
import { LogTimesheetSheet } from "@/components/me/log-timesheet-sheet";
import { NewTaskSheet } from "@/components/me/new-task-sheet";
import { TaskBoard } from "@/components/me/task-board";
import { NewExpenseClaimSheet } from "@/components/me/new-expense-claim-sheet";

const leaveStatusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  APPROVED: "default",
  PENDING: "secondary",
  REJECTED: "destructive",
};

const claimStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  REIMBURSED: "outline",
};

const attendanceVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PRESENT: "default",
  HALF_DAY: "secondary",
  ABSENT: "destructive",
  ON_LEAVE: "secondary",
  HOLIDAY: "outline",
};

export default async function MyHrPage() {
  const user = await getCurrentUser();
  const employeeId = user.employeeId;

  const [attendance, leaveRequests, timesheets, tasks, projects, expenseClaims] = employeeId
    ? await Promise.all([
        getMyAttendance(employeeId),
        getMyLeaveRequests(employeeId),
        getMyTimesheets(employeeId),
        getMyTasks(employeeId),
        getProjectOptions(),
        getMyExpenseClaims(employeeId),
      ])
    : [[], [], [], [], [], []];

  const presentCount = attendance.filter((a) => a.status === "PRESENT").length;

  return (
    <>
      <SiteHeader title="My HR" description="Personal attendance, leave & timesheet" />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Card>
          <CardContent className="flex items-center gap-3">
            <Avatar className="size-11">
              <AvatarFallback>{initials(user.employee?.name ?? user.email)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.employee?.name ?? user.email}</p>
              <p className="text-sm text-muted-foreground">
                {user.employee ? `${titleCase(user.employee.role)} · ${user.employee.department}` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">Recent attendance</CardTitle>
                <CardDescription>{presentCount} present in last {attendance.length} days</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {attendance.length === 0 && (
                <p className="text-sm text-muted-foreground">No attendance records.</p>
              )}
              {attendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                  <span className="text-muted-foreground">{formatDate(a.date)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{a.hoursWorked}h</span>
                    <Badge variant={attendanceVariant[a.status]} className="font-normal">
                      {titleCase(a.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">Leave</CardTitle>
                <CardDescription>Your requests</CardDescription>
              </div>
              <ApplyLeaveSheet />
            </CardHeader>
            <CardContent className="space-y-2">
              {leaveRequests.length === 0 && (
                <p className="text-sm text-muted-foreground">No leave requests yet.</p>
              )}
              {leaveRequests.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                  <div>
                    <p>{titleCase(l.type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(l.startDate)} – {formatDate(l.endDate)} ({l.days}d)
                    </p>
                  </div>
                  <Badge variant={leaveStatusVariant[l.status]} className="font-normal">
                    {titleCase(l.status)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">Timesheet</CardTitle>
                <CardDescription>Recent hours logged</CardDescription>
              </div>
              <LogTimesheetSheet projects={projects} />
            </CardHeader>
            <CardContent className="space-y-2">
              {timesheets.length === 0 && (
                <p className="text-sm text-muted-foreground">No timesheet entries yet.</p>
              )}
              {timesheets.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate">{t.taskDescription}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.project?.name ?? "—"} · {formatDate(t.date)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs">{t.hoursLogged}h</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">Expenses</CardTitle>
                <CardDescription>Your claims</CardDescription>
              </div>
              <NewExpenseClaimSheet />
            </CardHeader>
            <CardContent className="space-y-2">
              {expenseClaims.length === 0 && (
                <p className="text-sm text-muted-foreground">No expense claims yet.</p>
              )}
              {expenseClaims.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate">{titleCase(c.category)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(c.expenseDate)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-xs">{formatINR(c.amount)}</span>
                    <Badge variant={claimStatusVariant[c.status]} className="font-normal">
                      {titleCase(c.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">My Tasks</h2>
              <p className="text-xs text-muted-foreground">Your personal board</p>
            </div>
            <NewTaskSheet />
          </div>
          <TaskBoard tasks={tasks} />
        </div>
      </div>
    </>
  );
}
