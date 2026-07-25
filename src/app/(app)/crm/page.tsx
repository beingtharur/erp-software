import { getPipelineLeads, getClientOptions, getSalesReps } from "@/lib/queries/crm";
import { getCurrentUser } from "@/lib/dal";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { NewLeadSheet } from "@/components/crm/new-lead-sheet";

export default async function PipelinePage() {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [leads, clients, salesReps] = await Promise.all([
    getPipelineLeads(organizationId),
    getClientOptions(organizationId),
    getSalesReps(organizationId),
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
      <PipelineBoard leads={leads} />
    </div>
  );
}
