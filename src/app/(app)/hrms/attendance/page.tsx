import { getAttendanceToday } from "@/lib/queries/hrms";
import { getCurrentUser } from "@/lib/dal";
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
  const user = await getCurrentUser();
  const attendance = await getAttendanceToday(user.organizationId!);

  const presentCount = attendance.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length;
  const absentCount = attendance.filter((a) => a.status === "ABSENT").length;
  const onLeaveCount = attendance.filter((a) => a.status === "ON_LEAVE").length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Showing attendance for {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
        {" · "}
        {presentCount} present · {absentCount} absent · {onLeaveCount} on leave
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
              <TableHead className="text-right">Day Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendance.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No active employees yet — add someone under Employees and today&apos;s roster will
                  appear here.
                </TableCell>
              </TableRow>
            )}
            {attendance.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.employee.name}</TableCell>
                <TableCell className="text-muted-foreground">{a.employee.department?.name ?? "—"}</TableCell>
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
                  {a.leaveType && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {titleCase(a.leaveType)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {a.dayValue.toFixed(1)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
