import Link from "next/link";
import { getProjects } from "@/lib/queries/crm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatINR, titleCase } from "@/lib/format";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  PLANNING: "outline",
  IN_PROGRESS: "secondary",
  COMMISSIONING: "secondary",
  COMPLETED: "default",
};

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Target End</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead className="text-right">Tasks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">
                <Link href={`/crm/projects/${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{p.client.name}</TableCell>
              <TableCell className="text-right font-mono">{formatINR(p.value)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(p.targetEndDate)}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[p.status]} className="font-normal">
                  {titleCase(p.status)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={p.progressPercent} className="w-24" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {p.progressPercent}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {p._count.tasks}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
