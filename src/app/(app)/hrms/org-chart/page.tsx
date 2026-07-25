import { getOrgChart } from "@/lib/queries/hrms";
import { getCurrentUser } from "@/lib/dal";
import { OrgChart, type OrgNode } from "@/components/hrms/org-chart";

type FlatEmployee = {
  id: string;
  name: string;
  role: string;
  department: string;
  reportingToId: string | null;
};

function buildTree(employees: FlatEmployee[]): OrgNode[] {
  const byId = new Map<string, OrgNode>(
    employees.map((e) => [e.id, { id: e.id, name: e.name, role: e.role, department: e.department, children: [] }])
  );
  const roots: OrgNode[] = [];

  for (const emp of employees) {
    const node = byId.get(emp.id)!;
    const manager = emp.reportingToId ? byId.get(emp.reportingToId) : undefined;
    if (manager) {
      manager.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export default async function OrgChartPage() {
  const user = await getCurrentUser();
  const employees = await getOrgChart(user.organizationId!);
  const roots = buildTree(employees);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {employees.length} active employees · click a manager to expand their reports
      </p>
      <OrgChart roots={roots} />
    </div>
  );
}
