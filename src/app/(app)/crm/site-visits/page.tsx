import { getSiteVisits } from "@/lib/queries/crm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { SiteVisitStatusMenu } from "@/components/crm/site-visit-status-menu";

export default async function SiteVisitsPage() {
  const visits = await getSiteVisits();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead>Follow-up</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-medium">{v.client.name}</TableCell>
              <TableCell className="text-muted-foreground">{v.purpose}</TableCell>
              <TableCell className="max-w-48 truncate text-muted-foreground">
                {v.project?.name ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{v.assignedTo.name}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(v.scheduledDate)}</TableCell>
              <TableCell className="text-muted-foreground">
                {v.followUpDate ? formatDate(v.followUpDate) : "—"}
              </TableCell>
              <TableCell>
                <SiteVisitStatusMenu visitId={v.id} status={v.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
