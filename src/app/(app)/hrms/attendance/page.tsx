import { getAttendanceToday } from "@/lib/queries/hrms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatTime, titleCase } from "@/lib/format";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PRESENT: "default",
  HALF_DAY: "secondary",
  ABSENT: "destructive",
  ON_LEAVE: "secondary",
  HOLIDAY: "outline",
};

export default async function AttendancePage() {
  const attendance = await getAttendanceToday();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Showing attendance for {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
      </p>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendance.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.employee.name}</TableCell>
                <TableCell className="text-muted-foreground">{a.employee.department}</TableCell>
                <TableCell className="text-muted-foreground">
                  {a.checkIn ? formatTime(a.checkIn) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {a.checkOut ? formatTime(a.checkOut) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono">{a.hoursWorked}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[a.status]} className="font-normal">
                    {titleCase(a.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
