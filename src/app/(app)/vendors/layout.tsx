import { SiteHeader } from "@/components/layout/site-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { requireRole, requireModuleAccess } from "@/lib/dal";

const tabs = [
  { title: "Vendors", href: "/vendors" },
  { title: "Purchase Orders", href: "/vendors/purchase-orders" },
  { title: "Payments", href: "/vendors/payments" },
  { title: "Quotations", href: "/vendors/quotations" },
];

export default async function VendorsLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  await requireModuleAccess("vendors");

  return (
    <>
      <SiteHeader title="Vendor Management" description="Vendor records, purchase orders & payments" />
      <SectionTabs items={tabs} />
      <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
    </>
  );
}
