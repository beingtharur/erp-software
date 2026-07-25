import { SiteHeader } from "@/components/layout/site-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { requireRole, requireModuleAccess } from "@/lib/dal";

const tabs = [
  { title: "Overview", href: "/hrms" },
  { title: "Employees", href: "/hrms/employees" },
  { title: "Org Chart", href: "/hrms/org-chart" },
  { title: "Attendance", href: "/hrms/attendance" },
  { title: "Leave", href: "/hrms/leave" },
  { title: "Payroll", href: "/hrms/payroll" },
  { title: "Timesheets", href: "/hrms/timesheets" },
];

export default async function HrmsLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["ADMIN", "HR"]);
  await requireModuleAccess("hrms");

  return (
    <>
      <SiteHeader title="HRMS" description="Attendance, leave, payroll & workforce records" />
      <SectionTabs items={tabs} />
      <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
    </>
  );
}
