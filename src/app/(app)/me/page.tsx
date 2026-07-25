import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/dal";
import {
  getMyAttendance,
  getMyAttendanceToday,
  getMyLeaveRequests,
  getMyTimesheets,
  getMyTasks,
  getTasksAssignedByMe,
  getIsManager,
  getMyDailySummaries,
  getTodaysSummary,
  getTeamDailySummaries,
  getProjectOptions,
} from "@/lib/queries/me";
import { getMyExpenseClaims } from "@/lib/queries/finance";
import { getAssignableEmployees } from "@/lib/queries/crm";
import { formatDate, formatINR, initials, titleCase } from "@/lib/format";
import { ApplyLeaveSheet } from "@/components/me/apply-leave-sheet";
import { LogTimesheetSheet } from "@/components/me/log-timesheet-sheet";
import { NewTaskSheet } from "@/components/me/new-task-sheet";
import { TaskBoard } from "@/components/me/task-board";
import { TaskDetailSheet } from "@/components/me/task-detail-sheet";
import { NewExpenseClaimSheet } from "@/components/me/new-expense-claim-sheet";
import { AttendanceCheckButton } from "@/components/me/attendance-check-button";
import { DailySummaryForm } from "@/components/me/daily-summary-form";

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

  const [
    attendance,
    attendanceToday,
    leaveRequests,
    timesheets,
    tasks,
    projects,
    expenseClaims,
    isManager,
    assignableEmployees,
    todaysSummary,
    myDailySummaries,
  ] = employeeId
    ? await Promise.all([
        getMyAttendance(employeeId),
        getMyAttendanceToday(employeeId),
        getMyLeaveRequests(employeeId),
        getMyTimesheets(employeeId),
        getMyTasks(employeeId),
        getProjectOptions(user.organizationId!),
        getMyExpenseClaims(employeeId),
        getIsManager(employeeId),
        getAssignableEmployees(user.organizationId!),
        getTodaysSummary(employeeId),
        getMyDailySummaries(employeeId),
      ])
    : [[], null, [], [], [], [], [], false, [], null, []];

  const [assignedTasks, teamSummaries] = employeeId && isManager
    ? await Promise.all([getTasksAssignedByMe(employeeId), getTeamDailySummaries(employeeId)])
    : [[], []];

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
              {employeeId && (
                <AttendanceCheckButton
                  checkIn={attendanceToday?.checkIn ?? null}
                  checkOut={attendanceToday?.checkOut ?? null}
                />
              )}
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
            <NewTaskSheet
              currentEmployeeId={employeeId ?? undefined}
              assignableEmployees={assignableEmployees}
              isManager={isManager}
            />
          </div>
          <TaskBoard tasks={tasks} />
        </div>

        {isManager && (
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold">Team Tasks</h2>
              <p className="text-xs text-muted-foreground">Tasks you&apos;ve assigned to others</p>
            </div>
            <div className="rounded-lg border">
              {assignedTasks.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  You haven&apos;t assigned any tasks yet.
                </p>
              ) : (
                <div className="divide-y">
                  {assignedTasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.employee.name} · {titleCase(t.status)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {t.isBlocked && (
                          <Badge variant="destructive" className="font-normal">
                            Blocked
                          </Badge>
                        )}
                        <TaskDetailSheet task={t} viewerRole="assigner" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold">Evening Summary</h2>
            <p className="text-xs text-muted-foreground">
              What you completed, what&apos;s in progress, and your plan for tomorrow
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <DailySummaryForm existing={todaysSummary} />
          </div>
          {myDailySummaries.length > 0 && (
            <div className="flex flex-col gap-2">
              {myDailySummaries.map((s) => (
                <div key={s.id} className="rounded-md border p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">{formatDate(s.date)}</p>
                  {s.completedNote && <p className="mt-1"><span className="text-muted-foreground">Completed: </span>{s.completedNote}</p>}
                  {s.blockersNote && <p className="mt-1"><span className="text-muted-foreground">Blockers: </span>{s.blockersNote}</p>}
                  {s.nextDayPlan && <p className="mt-1"><span className="text-muted-foreground">Next day: </span>{s.nextDayPlan}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {isManager && (
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold">Team Summaries</h2>
              <p className="text-xs text-muted-foreground">Evening reports from your direct reports</p>
            </div>
            <div className="rounded-lg border">
              {teamSummaries.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No summaries submitted yet.</p>
              ) : (
                <div className="divide-y">
                  {teamSummaries.map((s) => (
                    <div key={s.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{s.employee.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(s.date)}</p>
                      </div>
                      {s.completedNote && <p className="mt-1 text-muted-foreground">Completed: {s.completedNote}</p>}
                      {s.pendingNote && <p className="mt-1 text-muted-foreground">Pending: {s.pendingNote}</p>}
                      {s.blockersNote && <p className="mt-1 text-destructive">Blockers: {s.blockersNote}</p>}
                      {s.nextDayPlan && <p className="mt-1 text-muted-foreground">Next day: {s.nextDayPlan}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
