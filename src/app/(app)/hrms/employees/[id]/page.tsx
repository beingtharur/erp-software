import { notFound } from "next/navigation";
import { getEmployeeDetail } from "@/lib/queries/hrms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, formatINR, initials, titleCase } from "@/lib/format";
import { UploadDocumentSheet } from "@/components/hrms/upload-document-sheet";
import { DocumentRow } from "@/components/hrms/document-row";
import { Mail, Phone, MapPin } from "lucide-react";

const leaveStatusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  APPROVED: "default",
  PENDING: "secondary",
  REJECTED: "destructive",
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployeeDetail(id);

  if (!employee) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback className="text-sm">{initials(employee.name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{employee.name}</h2>
                <Badge variant="outline" className="font-normal">{employee.employeeCode}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {titleCase(employee.role)} · {employee.department}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:items-end">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" /> {employee.baseLocation}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" /> {employee.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" /> {employee.phone}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Joined</p>
            <p className="text-lg font-semibold">{formatDate(employee.dateOfJoining)}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Reports To</p>
            <p className="text-lg font-semibold">{employee.reportingTo?.name ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Latest Net Pay</p>
            <p className="text-lg font-semibold">
              {employee.payrollRecords[0] ? formatINR(employee.payrollRecords[0].netPay) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge className="mt-1 font-normal">{titleCase(employee.status)}</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.attendances.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                <span className="text-muted-foreground">{formatDate(a.date)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{a.hoursWorked}h</span>
                  <Badge variant="outline" className="font-normal">{titleCase(a.status)}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Leave History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.leaveRequests.length === 0 && (
              <p className="text-sm text-muted-foreground">No leave requests.</p>
            )}
            {employee.leaveRequests.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                <div>
                  <p>{titleCase(l.type)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(l.startDate)} – {formatDate(l.endDate)}
                  </p>
                </div>
                <Badge variant={leaveStatusVariant[l.status]} className="font-normal">
                  {titleCase(l.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Payroll History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.payrollRecords.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                <span className="text-muted-foreground">
                  {new Date(p.year, p.month - 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{formatINR(p.netPay)}</span>
                  <Badge variant={p.status === "PROCESSED" ? "default" : "secondary"} className="font-normal">
                    {titleCase(p.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Timesheets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.timesheets.length === 0 && (
              <p className="text-sm text-muted-foreground">No timesheet entries.</p>
            )}
            {employee.timesheets.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate">{t.taskDescription}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.project?.name ?? "—"} · {formatDate(t.date)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs">{t.hoursLogged}h</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Documents</CardTitle>
          <UploadDocumentSheet employeeId={employee.id} />
        </CardHeader>
        <CardContent>
          {employee.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            employee.documents.map((doc) => <DocumentRow key={doc.id} doc={doc} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
