import {
  getPipelineLeads,
  getClientOptions,
  getProjectOptionsByClient,
  getAssignableEmployees,
} from "@/lib/queries/crm";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { NewLeadSheet } from "@/components/crm/new-lead-sheet";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default async function PipelinePage() {
  // Procurement passes the layout's broadened gate (Quotations-only) but
  // isn't meant to reach Pipeline — re-checked here since the layout alone
  // can't scope a single role out of one page.
  await requireRole(["ADMIN", "SALES"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [leads, clients, projects, employees] = await Promise.all([
    getPipelineLeads(organizationId),
    getClientOptions(organizationId),
    getProjectOptionsByClient(organizationId),
    getAssignableEmployees(organizationId),
  ]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<a href="/api/exports/leads" />}>
          <Download />
          Export to Excel
        </Button>
        <NewLeadSheet
          clients={clients}
          // Owner was previously restricted to SALES_REP-only employees,
          // which left a freshly registered org (no employees yet, or none
          // tagged SALES_REP) with an empty, seemingly "broken" select. The
          // create-lead action never actually enforces that the owner be a
          // sales rep, so any active employee is a valid owner.
          salesReps={employees}
          isAdmin={user.accessRole === "ADMIN"}
          currentEmployeeId={user.employeeId}
        />
      </div>
      <PipelineBoard leads={leads} clientOptions={clients} projects={projects} employees={employees} />
    </div>
  );
}
