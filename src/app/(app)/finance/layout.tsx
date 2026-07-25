import { SiteHeader } from "@/components/layout/site-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { requireRole, requireModuleAccess } from "@/lib/dal";

const tabs = [
  { title: "Expense Claims", href: "/finance" },
  { title: "Budgets", href: "/finance/budgets" },
];

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["ADMIN", "FINANCE"]);
  await requireModuleAccess("finance");

  return (
    <>
      <SiteHeader title="Finance" description="Expense claims & departmental budgets" />
      <SectionTabs items={tabs} />
      <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
    </>
  );
}
