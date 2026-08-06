import Link from "next/link";
import { getPayrollRecords, getEmployeesWithoutSalaryStructure } from "@/lib/queries/hrms";
import { getCurrentUser } from "@/lib/dal";
import { MissingSalaryRowMenu } from "@/components/hrms/missing-salary-row-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/format";
import { ProcessPayrollButton } from "@/components/hrms/process-payroll-button";
import { GeneratePayrollButton } from "@/components/hrms/generate-payroll-button";
import { UnlockPayrollButton } from "@/components/hrms/unlock-payroll-button";

const monthLabel = (month: number, year: number) =>
  new Date(year, month - 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

export default async function PayrollPage() {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [records, employeesMissingSalary] = await Promise.all([
    getPayrollRecords(organizationId),
    getEmployeesWithoutSalaryStructure(organizationId),
  ]);
  const isAdmin = user.accessRole === "ADMIN";

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {employeesMissingSalary.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium">
            {employeesMissingSalary.length} active employee
            {employeesMissingSalary.length === 1 ? "" : "s"} without a salary structure
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Payroll skips anyone without one set up — use the ⋯ menu beside them to add one.
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {employeesMissingSalary.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-1.5"
              >
                <Link href={`/hrms/employees/${e.id}`} className="text-primary hover:underline">
                  {e.name} ({e.employeeCode})
                </Link>
                <MissingSalaryRowMenu employeeId={e.id} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <GeneratePayrollButton />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Basic</TableHead>
              <TableHead className="text-right">Allowances</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No payroll records yet. Generate a period above.
                </TableCell>
              </TableRow>
            )}
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.employee.name}</TableCell>
                <TableCell className="text-muted-foreground">{monthLabel(r.month, r.year)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatINR(r.basicSalary)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatINR(r.allowances)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatINR(r.deductions)}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">{formatINR(r.netPay)}</TableCell>
                <TableCell className="text-right">
                  {r.status === "PENDING" ? (
                    <div className="flex justify-end">
                      <ProcessPayrollButton payrollId={r.id} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1.5">
                      <Badge className="font-normal">Processed</Badge>
                      {isAdmin && <UnlockPayrollButton payrollId={r.id} />}
                    </div>
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
