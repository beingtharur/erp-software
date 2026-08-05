import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { getMyTasks, getTasksAssignedByMe } from "@/lib/queries/tasks";
import { getIsManager } from "@/lib/queries/me";
import { getAssignableEmployees } from "@/lib/queries/crm";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewTaskSheet } from "@/components/tasks/new-task-sheet";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { formatDate, titleCase } from "@/lib/format";

/**
 * The employee-facing half of the task system: everything assigned to you by an
 * admin, HR or your manager, plus anything you added yourself. Same model, same
 * actions and same board component the HRMS console manages — this page exists
 * so an employee has one obvious place to go, rather than having to know the
 * task board lives partway down /me.
 */
export default async function MyTasksPage() {
  const user = await getCurrentUser();
  const employeeId = user.employeeId;

  if (!employeeId) {
    return (
      <>
        <SiteHeader title="My Tasks" description="Work assigned to you" />
        <div className="flex flex-1 flex-col p-4 md:p-6">
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Your login isn&apos;t linked to an employee profile yet, so there&apos;s nothing to
              show here. Use “Complete your profile” at the top of the page to set one up.
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const [tasks, isManagerByReports, assignableEmployees] = await Promise.all([
    getMyTasks(employeeId),
    getIsManager(employeeId),
    getAssignableEmployees(user.organizationId!),
  ]);

  // Matches /me: ADMIN (and now HR, who run task management) can always hand
  // work to anyone, without needing direct reports on the org chart.
  const isManager =
    user.accessRole === "ADMIN" || user.accessRole === "HR" || isManagerByReports;

  const assignedTasks = isManager ? await getTasksAssignedByMe(employeeId) : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const openTasks = tasks.filter((t) => t.status !== "DONE");
  const overdue = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < today);
  const fromOthers = tasks.filter((t) => t.assignedById !== null);

  return (
    <>
      <SiteHeader title="My Tasks" description="Work assigned to you, and your own to-dos" />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary" className="font-normal">
              {openTasks.length} open
            </Badge>
            <Badge variant={overdue.length > 0 ? "destructive" : "outline"} className="font-normal">
              {overdue.length} overdue
            </Badge>
            <Badge variant="outline" className="font-normal">
              {fromOthers.length} assigned to you
            </Badge>
          </div>
          <NewTaskSheet
            currentEmployeeId={employeeId}
            assignableEmployees={assignableEmployees}
            isManager={isManager}
          />
        </div>

        <TaskBoard tasks={tasks} />

        {isManager && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Tasks you&apos;ve assigned</h2>
                <p className="text-xs text-muted-foreground">Work you handed to other people</p>
              </div>
              {(user.accessRole === "ADMIN" || user.accessRole === "HR") && (
                <Link
                  href="/hrms/tasks"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Open HRMS Tasks →
                </Link>
              )}
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
                          {t.dueDate ? ` · Due ${formatDate(t.dueDate)}` : ""}
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
      </div>
    </>
  );
}
