import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectDetail, getAssignableEmployees } from "@/lib/queries/crm";
import { getCurrentUser } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NewMilestoneSheet } from "@/components/crm/new-milestone-sheet";
import { NewProjectTaskSheet } from "@/components/crm/new-project-task-sheet";
import { ProjectTaskRow } from "@/components/crm/project-task-row";
import { MilestoneStatusMenu } from "@/components/crm/milestone-status-menu";
import { formatDate, formatINR, titleCase } from "@/lib/format";
import { HardHat } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  PLANNING: "outline",
  IN_PROGRESS: "secondary",
  COMMISSIONING: "secondary",
  COMPLETED: "default",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [project, employees] = await Promise.all([
    getProjectDetail(id, organizationId),
    getAssignableEmployees(organizationId),
  ]);

  if (!project) notFound();

  const milestoneOptions = project.milestones.map((m) => ({ id: m.id, name: m.title }));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HardHat className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{project.name}</h2>
                <Badge variant={statusVariant[project.status]} className="font-normal">
                  {titleCase(project.status)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                <Link href={`/crm/clients/${project.clientId}`} className="hover:underline">
                  {project.client.name}
                </Link>
                {" · "}
                {titleCase(project.productLine)}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:items-end">
            <span>{formatINR(project.value)}</span>
            <span>Target end {formatDate(project.targetEndDate)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardContent className="px-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall progress</span>
            <span className="text-muted-foreground tabular-nums">{project.progressPercent}%</span>
          </div>
          <Progress value={project.progressPercent} className="mt-2" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Calculated from completed tasks below — not manually set.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Milestones</h3>
        <div className="flex items-center gap-2">
          <NewProjectTaskSheet projectId={project.id} milestones={milestoneOptions} employees={employees} />
          <NewMilestoneSheet projectId={project.id} />
        </div>
      </div>

      {project.milestones.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No milestones yet.
          </CardContent>
        </Card>
      )}

      {project.milestones.map((milestone) => (
        <Card key={milestone.id}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">{milestone.title}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(milestone.dueDate)}</p>
            </div>
            <MilestoneStatusMenu milestoneId={milestone.id} status={milestone.status} />
          </CardHeader>
          <CardContent>
            {milestone.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks under this milestone yet.</p>
            ) : (
              milestone.tasks.map((task) => <ProjectTaskRow key={task.id} task={task} />)
            )}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Unassigned tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {project.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No standalone tasks.</p>
          ) : (
            project.tasks.map((task) => <ProjectTaskRow key={task.id} task={task} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
