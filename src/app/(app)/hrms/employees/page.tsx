import Link from "next/link";
import { getEmployees } from "@/lib/queries/hrms";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, initials, titleCase } from "@/lib/format";
import { employeeRoleName } from "@/lib/roles";
import { NewEmployeeSheet } from "@/components/hrms/new-employee-sheet";
import { DeleteEmployeeButton } from "@/components/hrms/employee-row-actions";
import { EditEmployeeSheet } from "@/components/hrms/edit-employee-sheet";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  ON_LEAVE: "secondary",
  INACTIVE: "destructive",
};

export default async function EmployeesPage() {
  const user = await getCurrentUser();
  const employees = await getEmployees(user.organizationId!);
  const managerOptions = employees.map((e) => ({ id: e.id, name: e.name }));

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <NewEmployeeSheet />
      </div>
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Job title</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                No employees yet. Add your first team member above.
              </TableCell>
            </TableRow>
          )}
          {employees.map((emp) => (
            <TableRow key={emp.id}>
              <TableCell>
                <Link href={`/hrms/employees/${emp.id}`} className="flex items-center gap-2.5 hover:underline">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">{initials(emp.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium leading-none">{emp.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{emp.employeeCode}</p>
                  </div>
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{employeeRoleName(emp.role)}</TableCell>
              <TableCell className="text-muted-foreground">{emp.department}</TableCell>
              <TableCell className="text-muted-foreground">{emp.baseLocation}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(emp.dateOfJoining)}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[emp.status]} className="font-normal">
                  {titleCase(emp.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1.5">
                  <EditEmployeeSheet
                    employee={{
                      id: emp.id,
                      name: emp.name,
                      department: emp.department,
                      phone: emp.phone,
                      baseLocation: emp.baseLocation,
                      status: emp.status,
                      reportingToId: emp.reportingToId,
                    }}
                    managerOptions={managerOptions}
                  />
                  {emp.id !== user.employeeId && (
                    <DeleteEmployeeButton employeeId={emp.id} employeeName={emp.name} />
                  )}
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
