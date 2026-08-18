import {
  getSiteVisits,
  getClientOptions,
  getProjectOptionsByClient,
  getAssignableEmployees,
} from "@/lib/queries/crm";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { NewSiteVisitSheet } from "@/components/crm/new-site-visit-sheet";
import { SiteVisitsView } from "@/components/crm/site-visits-view";

export default async function SiteVisitsPage() {
  // Procurement passes the layout's broadened gate (Quotations-only) but
  // isn't meant to reach Site Visits — re-checked here since the layout
  // alone can't scope a single role out of one page.
  await requireRole(["ADMIN", "SALES"]);
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
