import { SiteHeader } from "@/components/layout/site-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { requireRole } from "@/lib/dal";

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
  await requireRole(["ADMIN", "SALES"]);

  return (
    <>
      <SiteHeader title="CRM" description="Leads, clients, quotations & service contracts" />
      <SectionTabs items={tabs} />
      <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
    </>
  );
}
