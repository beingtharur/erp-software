import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { getDepartments } from "@/lib/queries/departments";
import { getEmployees } from "@/lib/queries/hrms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DepartmentSheet } from "@/components/hrms/department-sheet";
import { DepartmentStatusButton } from "@/components/hrms/department-status-button";
import { DepartmentFilters } from "@/components/departments/department-filters";
import { orgUnitTypeName } from "@/lib/departments";

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; type?: string }>;
}) {
  const filters = await searchParams;
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const [departments, allDepartments, employees] = await Promise.all([
    getDepartments(organizationId, filters),
    // Unfiltered, so the parent picker always offers every unit even while the
    // list itself is filtered down.
    getDepartments(organizationId),
    getEmployees(organizationId),
  ]);

  const isFiltered = Boolean(filters.search || (filters.status && filters.status !== "ALL") || (filters.type && filters.type !== "ALL"));

  const employeeOptions = employees.map((e) => ({ id: e.id, name: e.name }));
  const parentOptions = allDepartments.map((d) => ({ id: d.id, name: d.name }));
  const activeCount = allDepartments.filter((d) => d.isActive).length;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {allDepartments.length} unit{allDepartments.length === 1 ? "" : "s"}
          {allDepartments.length > 0 && ` · ${activeCount} active`}
          {isFiltered && ` · showing ${departments.length}`}
        </p>
        <DepartmentSheet employees={employeeOptions} parentOptions={parentOptions} />
      </div>

      {/* useSearchParams() gets its own Suspense boundary so it can't suspend
          the table alongside it. Note: a route-level loading.tsx was tried here
          and left the route permanently in its fallback — the rows rendered
          into the DOM but stayed hidden behind the skeleton. The filter bar
          shows its own pending state instead. */}
      <Suspense fallback={<div className="h-14" />}>
        <DepartmentFilters />
      </Suspense>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Head</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead className="text-right">Employees</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  {isFiltered
                    ? "No units match these filters. Try clearing them."
                    : "No departments yet. Create your first one above — employees and budgets can then be assigned to it."}
                </TableCell>
              </TableRow>
            )}
            {departments.map((d) => (
              <TableRow key={d.id} className={d.isActive ? "" : "opacity-60"}>
                <TableCell>
                  <p className="font-medium">{d.name}</p>
                  {d.description && (
                    <p className="max-w-72 truncate text-xs text-muted-foreground">
                      {d.description}
                    </p>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{d.code}</TableCell>
                <TableCell className="text-muted-foreground">{orgUnitTypeName(d.type)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {d.head ? (
                    <Link href={`/hrms/employees/${d.head.id}`} className="hover:underline">
                      {d.head.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {d.parent?.name ?? "Top level"}
                  {d._count.children > 0 && (
                    <span className="ml-1.5 text-xs">
                      · {d._count.children} sub-department{d._count.children === 1 ? "" : "s"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {d._count.employees > 0 ? (
                    <Link
                      href={`/hrms/employees`}
                      className="text-muted-foreground hover:underline"
                    >
                      {d._count.employees}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={d.isActive ? "default" : "secondary"} className="font-normal">
                    {d.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <DepartmentSheet
                      department={{
                        id: d.id,
                        name: d.name,
                        code: d.code,
                        type: d.type,
                        description: d.description,
                        headId: d.headId,
                        parentId: d.parentId,
                      }}
                      employees={employeeOptions}
                      parentOptions={parentOptions}
                    />
                    <DepartmentStatusButton
                      departmentId={d.id}
                      departmentName={d.name}
                      isActive={d.isActive}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
