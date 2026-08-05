import { requireRole, getCurrentUser } from "@/lib/dal";
import { getUsers, getEmployeesWithoutLogin } from "@/lib/queries/admin";
import { SiteHeader } from "@/components/layout/site-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NewUserSheet } from "@/components/admin/new-user-sheet";
import { EditUserSheet } from "@/components/admin/edit-user-sheet";
import { UserRoleSelect, RevokeAccessButton } from "@/components/admin/user-row-actions";
import { formatDate, initials } from "@/lib/format";
import { employeeRoleName } from "@/lib/roles";

export default async function AdminUsersPage() {
  await requireRole(["ADMIN"]);
  const currentUser = await getCurrentUser();

  const organizationId = currentUser.organizationId!;
  const [users, eligibleEmployees] = await Promise.all([
    getUsers(organizationId),
    getEmployeesWithoutLogin(organizationId),
  ]);

  return (
    <>
      <SiteHeader
        title="User & Role Management"
        description="Portal logins and the access level each one carries"
      />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {users.length} user{users.length === 1 ? "" : "s"} with portal access ·{" "}
            {eligibleEmployees.length} employee{eligibleEmployees.length === 1 ? "" : "s"} without a login
          </p>
          <NewUserSheet employees={eligibleEmployees} />
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Portal access level</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[10px]">
                          {initials(user.employee?.name ?? user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium leading-none">
                          {user.employee?.name ?? "(no employee record)"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.employee ? employeeRoleName(user.employee.role) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.employee?.department ?? "—"}
                  </TableCell>
                  <TableCell>
                    <UserRoleSelect userId={user.id} accessRole={user.accessRole} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <EditUserSheet
                        user={{
                          id: user.id,
                          email: user.email,
                          accessRole: user.accessRole,
                          employeeName: user.employee?.name ?? null,
                          modules: user.moduleAccess.map((m) => m.module),
                        }}
                      />
                      {user.id !== currentUser.id && <RevokeAccessButton userId={user.id} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
