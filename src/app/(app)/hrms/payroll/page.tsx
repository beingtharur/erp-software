import { getPayrollRecords } from "@/lib/queries/hrms";
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

const monthLabel = (month: number, year: number) =>
  new Date(year, month - 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

export default async function PayrollPage() {
  const records = await getPayrollRecords();

  return (
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
                  <Badge className="font-normal">Processed</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
