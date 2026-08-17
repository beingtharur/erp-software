import { getLeaveRequests } from "@/lib/queries/hrms";
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
import { Button } from "@/components/ui/button";
import { formatDate, titleCase } from "@/lib/format";
import { LeaveDecisionButtons } from "@/components/hrms/leave-decision-buttons";
import { Download } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  APPROVED: "default",
  PENDING: "secondary",
  REJECTED: "destructive",
};

export default async function LeavePage() {
  const user = await getCurrentUser();
  const requests = await getLeaveRequests(user.organizationId!);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" nativeButton={false} render={<a href="/api/exports/leaves" />}>
          <Download />
          Export to Excel
        </Button>
      </div>
      <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Applied On</TableHead>
            <TableHead className="text-right">Status / Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                No leave requests yet. They appear here once an employee applies from My HR.
              </TableCell>
            </TableRow>
          )}
          {requests.map((leave) => (
            <TableRow key={leave.id}>
              <TableCell className="font-medium">{leave.employee.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {titleCase(leave.type)}
                {leave.type === "HALF_DAY" && leave.halfDayPeriod && (
                  <span className="text-xs"> · {titleCase(leave.halfDayPeriod)}</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
              </TableCell>
              <TableCell className="text-right">{leave.days}</TableCell>
              <TableCell className="max-w-48 truncate text-muted-foreground">{leave.reason}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(leave.appliedOn)}</TableCell>
              <TableCell className="text-right">
                {leave.status === "PENDING" ? (
                  <div className="flex justify-end">
                    <LeaveDecisionButtons leaveId={leave.id} />
                  </div>
                ) : (
                  <Badge variant={statusVariant[leave.status]} className="font-normal">
                    {titleCase(leave.status)}
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
