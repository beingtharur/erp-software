import { SiteHeader } from "@/components/layout/site-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { requireRole, requireModuleAccess } from "@/lib/dal";

const tabs = [
  { title: "Live Map", href: "/field" },
  { title: "Visit History", href: "/field/visits" },
  { title: "Geofences", href: "/field/geofences" },
];

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  // SALES and PROCUREMENT are admitted so a sales rep (Rajvinder) or the
  // Proposal Manager (Sachin) granted the field module can reach Live Map,
  // Visit History and Geofences. requireModuleAccess below is what actually
  // decides: anyone without the grant still gets bounced.
  await requireRole(["ADMIN", "FIELD", "SALES", "PROCUREMENT"]);
  await requireModuleAccess("field");

  return (
    <>
      <SiteHeader title="GPS & Field Tracking" description="Live location, geofenced check-ins & visit history" />
      <SectionTabs items={tabs} />
      <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
    </>
  );
}
