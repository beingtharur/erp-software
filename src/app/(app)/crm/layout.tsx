import { SiteHeader } from "@/components/layout/site-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { requireRole, requireModuleAccess, getCurrentUser } from "@/lib/dal";

const tabs = [
  { title: "Pipeline", href: "/crm" },
  { title: "Clients", href: "/crm/clients" },
  { title: "Projects", href: "/crm/projects" },
  { title: "Quotations", href: "/crm/quotations" },
  { title: "Site Visits", href: "/crm/site-visits" },
  { title: "AMC Contracts", href: "/crm/amc" },
  { title: "Helpdesk", href: "/crm/helpdesk" },
];

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  // Procurement's access is Quotations-only — admitted here so they can
  // reach that one page, but every other CRM page re-checks ADMIN/SALES
  // itself (defense in depth: this layout gate alone can't scope them out
  // of the other 6 pages, only out of CRM entirely).
  await requireRole(["ADMIN", "SALES", "PROCUREMENT"]);
  await requireModuleAccess("crm");
  const user = await getCurrentUser();
  const visibleTabs =
    user.accessRole === "PROCUREMENT" ? tabs.filter((t) => t.href === "/crm/quotations") : tabs;

  return (
    <>
      <SiteHeader title="CRM" description="Leads, clients, quotations & service contracts" />
      <SectionTabs items={visibleTabs} />
      <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
    </>
  );
}
