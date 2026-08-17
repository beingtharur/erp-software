import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getAttendanceForExport } from "@/lib/queries/hrms";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { attendanceExportColumns } from "@/lib/export/attendance";
import { logExport } from "@/lib/export/audit";

// Same access gates as /hrms/attendance, the page this mirrors.
export async function GET(request: NextRequest) {
  await requireRole(["ADMIN", "HR"]);
  await requireModuleAccess("hrms");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  const params = request.nextUrl.searchParams;

  // Defaults to month-to-date when no range is given — an org's whole
  // attendance history has no natural cap otherwise (50 employees x 30 days
  // is already ~1500 rows for a single month).
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const fromParam = params.get("fromDate");
  const toParam = params.get("toDate");
  const fromDate = fromParam ? new Date(`${fromParam}T00:00:00`) : monthStart;
  const toDate = toParam ? new Date(`${toParam}T23:59:59.999`) : todayEnd;

  const departmentId = params.get("departmentId") || undefined;
  const employeeId = params.get("employeeId") || undefined;
  const status = params.get("status") || undefined;

  const rows = await getAttendanceForExport(user.organizationId!, {
    fromDate,
    toDate,
    departmentId,
    employeeId,
    status,
  });

  // Read even though Phase 1 doesn't expose these as UI controls on
  // /hrms/attendance yet — every filter param works today via the URL.
  const filters: Record<string, unknown> = {};
  if (fromParam) filters.fromDate = fromParam;
  if (toParam) filters.toDate = toParam;
  if (departmentId) filters.departmentId = departmentId;
  if (employeeId) filters.employeeId = employeeId;
  if (status) filters.status = status;

  // Logged after the permission checks pass but before the response is built —
  // only genuinely-authorized, actually-served downloads get recorded.
  await logExport({
    report: "attendance",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: "Attendance Report",
    organizationName: organization.name,
    sheetName: "Attendance",
    columns: attendanceExportColumns,
    rows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("attendance")}"`,
    },
  });
}
