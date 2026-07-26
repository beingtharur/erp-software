import {
  getPipelineLeads,
  getClientOptions,
  getSalesReps,
  getProjectOptionsByClient,
  getAssignableEmployees,
} from "@/lib/queries/crm";
import { getCurrentUser } from "@/lib/dal";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { NewLeadSheet } from "@/components/crm/new-lead-sheet";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [leads, clients, salesReps, projects, employees] = await Promise.all([
    getPipelineLeads(organizationId),
    getClientOptions(organizationId),
    getSalesReps(organizationId),
    getProjectOptionsByClient(organizationId),
    getAssignableEmployees(organizationId),
  ]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <NewLeadSheet
          clients={clients}
          salesReps={salesReps}
          isAdmin={user.accessRole === "ADMIN"}
          currentEmployeeId={user.employeeId}
        />
      </div>
      <PipelineBoard leads={leads} clientOptions={clients} projects={projects} employees={employees} />
    </div>
  );
}
