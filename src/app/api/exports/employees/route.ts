import type { NextRequest } from "next/server";
import { requireRole, requireModuleAccess, getCurrentUser, getCurrentOrganization } from "@/lib/dal";
import { getEmployees } from "@/lib/queries/hrms";
import { buildReportWorkbook, buildExportFilename } from "@/lib/export/workbook";
import { employeeExportColumns, type EmployeeExportRow } from "@/lib/export/employees";
import { logExport } from "@/lib/export/audit";

// Same access gates as /hrms/employees, the page this mirrors — exports don't
// get their own permission concept, they inherit the one for the data they expose.
export async function GET(request: NextRequest) {
  await requireRole(["ADMIN", "HR"]);
  await requireModuleAccess("hrms");
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();

  let rows = await getEmployees(user.organizationId!);

  // Filter-ready even though Phase 1 doesn't expose this in the UI yet —
  // ?status=ACTIVE works today, and future reports follow the same shape.
  const status = request.nextUrl.searchParams.get("status");
  if (status) {
    rows = rows.filter((r: EmployeeExportRow) => r.status === status);
  }

  // Logged after the permission checks pass but before the response is built —
  // only genuinely-authorized, actually-served downloads get recorded.
  await logExport({
    report: "employees",
    organizationId: user.organizationId!,
    userId: user.id,
    filters: status ? { status } : undefined,
  });

  const buffer = await buildReportWorkbook({
    reportTitle: "Employee Report",
    organizationName: organization.name,
    sheetName: "Employees",
    columns: employeeExportColumns,
    rows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${buildExportFilename("employees")}"`,
    },
  });
}
