import {
  getSiteVisits,
  getClientOptions,
  getProjectOptionsByClient,
  getAssignableEmployees,
} from "@/lib/queries/crm";
import { getCurrentUser } from "@/lib/dal";
import { NewSiteVisitSheet } from "@/components/crm/new-site-visit-sheet";
import { SiteVisitsView } from "@/components/crm/site-visits-view";

export default async function SiteVisitsPage() {
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  const [visits, clients, projects, employees] = await Promise.all([
    getSiteVisits(organizationId),
    getClientOptions(organizationId),
    getProjectOptionsByClient(organizationId),
    getAssignableEmployees(organizationId),
  ]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex justify-end">
        <NewSiteVisitSheet clients={clients} projects={projects} employees={employees} />
      </div>
      <SiteVisitsView visits={visits} clients={clients} projects={projects} employees={employees} />
    </div>
  );
}
