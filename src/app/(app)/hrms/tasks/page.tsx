import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { getOrgTasks, getTaskStats } from "@/lib/queries/tasks";
import { getEmployees } from "@/lib/queries/hrms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NewTaskSheet } from "@/components/tasks/new-task-sheet";
import { EditTaskSheet } from "@/components/tasks/edit-task-sheet";
import { TaskStatusMenu } from "@/components/tasks/task-status-menu";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { formatDate } from "@/lib/format";
import { ListChecks, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

const priorityVariant: Record<string, "default" | "secondary" | "outline"> = {
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "outline",
};

const priorityLabel: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function HrmsTasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    employeeId?: string;
    status?: string;
    priority?: string;
    due?: string;
    search?: string;
  }>;
}) {
  const filters = await searchParams;
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const [tasks, stats, employees] = await Promise.all([
    getOrgTasks(organizationId, filters),
    getTaskStats(organizationId),
    getEmployees(organizationId),
  ]);

  const employeeOptions = employees.map((e) => ({ id: e.id, name: e.name }));
  const today = startOfToday();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Tasks" value={String(stats.total)} icon={ListChecks} />
        <KpiCard
          label="Pending Tasks"
          value={String(stats.pending)}
          sub="not yet done"
          icon={Clock}
          tone={stats.pending > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Overdue Tasks"
          value={String(stats.overdue)}
          sub="past due date"
          icon={AlertTriangle}
          tone={stats.overdue > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Completed Today"
          value={String(stats.completedToday)}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <TaskFilters employees={employeeOptions} />
        <NewTaskSheet
          variant="assign"
          currentEmployeeId={user.employeeId ?? undefined}
          assignableEmployees={employeeOptions}
          isManager
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Assigned by</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No tasks match these filters. Assign one above, or clear the filters.
                </TableCell>
              </TableRow>
            )}
            {tasks.map((task) => {
              const overdue =
                task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < today;
              return (
                <TableRow key={task.id}>
                  <TableCell>
                    <p className="font-medium">{task.title}</p>
                    {task.description && (
                      <p className="max-w-72 truncate text-xs text-muted-foreground">
                        {task.description}
                      </p>
                    )}
                    {task.isBlocked && (
                      <Badge variant="destructive" className="mt-1 text-[10px] font-normal">
                        Blocked
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/hrms/employees/${task.employee.id}`}
                      className="font-medium hover:underline"
                    >
                      {task.employee.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{task.employee.department?.name ?? "—"}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.assignedBy?.name ?? "Self-created"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant[task.priority]} className="font-normal">
                      {priorityLabel[task.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell className={overdue ? "text-destructive" : "text-muted-foreground"}>
                    {task.dueDate ? formatDate(task.dueDate) : "—"}
                  </TableCell>
                  <TableCell>
                    <TaskStatusMenu taskId={task.id} status={task.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <TaskDetailSheet task={task} viewerRole="assigner" />
                      <EditTaskSheet task={task} employees={employeeOptions} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
