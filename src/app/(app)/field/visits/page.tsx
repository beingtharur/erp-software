import { getVisitLogs } from "@/lib/queries/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export default async function VisitHistoryPage() {
  const visits = await getVisitLogs();

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Check In</TableHead>
            <TableHead>Check Out</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-medium">{v.employee.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {v.geofence.client?.name ?? v.geofence.name}
              </TableCell>
              <TableCell className="text-muted-foreground">{v.purpose}</TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(v.checkInTime)}</TableCell>
              <TableCell className="text-muted-foreground">
                {v.checkOutTime ? formatDateTime(v.checkOutTime) : "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {v.durationMinutes ? `${Math.floor(v.durationMinutes / 60)}h ${v.durationMinutes % 60}m` : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={v.status === "CHECKED_IN" ? "default" : "outline"} className="font-normal">
                  {v.status === "CHECKED_IN" ? "Checked In" : "Checked Out"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
