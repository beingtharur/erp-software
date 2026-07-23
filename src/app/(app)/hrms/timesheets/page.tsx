import { getTimesheets } from "@/lib/queries/hrms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export default async function TimesheetsPage() {
  const timesheets = await getTimesheets();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Task</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead>Billable</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {timesheets.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.employee.name}</TableCell>
              <TableCell className="max-w-56 truncate text-muted-foreground">
                {t.project?.name ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{t.taskDescription}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(t.date)}</TableCell>
              <TableCell className="text-right font-mono">{t.hoursLogged}</TableCell>
              <TableCell>
                <Badge variant={t.billable ? "default" : "secondary"} className="font-normal">
                  {t.billable ? "Billable" : "Non-billable"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
