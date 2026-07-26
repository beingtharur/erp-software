import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewSalaryStructureSheet } from "@/components/hrms/new-salary-structure-sheet";
import { formatDate, formatINR } from "@/lib/format";

type SalaryStructure = {
  id: string;
  basicSalary: number;
  hra: number;
  da: number;
  travelAllowance: number;
  medicalAllowance: number;
  specialAllowance: number;
  bonus: number;
  pf: number;
  esi: number;
  professionalTax: number;
  incomeTax: number;
  overtimeRate: number;
  effectiveFrom: Date | string;
};

export function SalaryStructureCard({
  employeeId,
  active,
  history,
}: {
  employeeId: string;
  active: SalaryStructure | null;
  history: SalaryStructure[];
}) {
  const allowances = active
    ? active.hra + active.da + active.travelAllowance + active.medicalAllowance + active.specialAllowance
    : 0;
  const deductions = active ? active.pf + active.esi + active.professionalTax + active.incomeTax : 0;
  const gross = active ? active.basicSalary + allowances + active.bonus : 0;
  const priorStructures = history.filter((s) => s.id !== active?.id);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Salary Structure</CardTitle>
        <NewSalaryStructureSheet employeeId={employeeId} current={active} />
      </CardHeader>
      <CardContent className="space-y-3">
        {!active ? (
          <p className="text-sm text-muted-foreground">No salary structure set up yet.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Effective from {formatDate(active.effectiveFrom)}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <span className="text-muted-foreground">Basic Salary</span>
              <span className="text-right font-mono">{formatINR(active.basicSalary)}</span>
              <span className="text-muted-foreground">Allowances</span>
              <span className="text-right font-mono">{formatINR(allowances)}</span>
              <span className="text-muted-foreground">Bonus</span>
              <span className="text-right font-mono">{formatINR(active.bonus)}</span>
              <span className="font-medium">Gross</span>
              <span className="text-right font-mono font-medium">{formatINR(gross)}</span>
              <span className="text-muted-foreground">Deductions (PF/ESI/Tax)</span>
              <span className="text-right font-mono text-destructive">−{formatINR(deductions)}</span>
            </div>
          </>
        )}
        {priorStructures.length > 0 && (
          <div className="border-t pt-2">
            <p className="mb-1 text-xs text-muted-foreground">History</p>
            <div className="space-y-1">
              {priorStructures.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>From {formatDate(s.effectiveFrom)}</span>
                  <span className="font-mono">{formatINR(s.basicSalary)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
