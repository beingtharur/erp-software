import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  CalendarClock,
  ShieldCheck,
  Contact,
  CalendarDays,
  Plane,
  Wallet,
  Clock,
  Truck,
  ClipboardList,
  Banknote,
  MapPin,
  History,
  MapPinned,
  HardHat,
  LifeBuoy,
  Receipt,
  PiggyBank,
  ListChecks,
} from "lucide-react";
import type { AccessRole } from "@/generated/prisma/client";

export type NavLeaf = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  key: "crm" | "hrms" | "vendors" | "field" | "finance";
  title: string;
  href: string;
  icon: LucideIcon;
  items: NavLeaf[];
};

export const navSections: NavSection[] = [
  {
    key: "crm",
    title: "CRM",
    href: "/crm",
    icon: Contact,
    items: [
      { title: "Pipeline", href: "/crm", icon: LayoutDashboard },
      { title: "Clients", href: "/crm/clients", icon: Building2 },
      { title: "Projects", href: "/crm/projects", icon: HardHat },
      { title: "Quotations", href: "/crm/quotations", icon: FileText },
      { title: "Site Visits", href: "/crm/site-visits", icon: CalendarClock },
      { title: "AMC Contracts", href: "/crm/amc", icon: ShieldCheck },
      { title: "Helpdesk", href: "/crm/helpdesk", icon: LifeBuoy },
    ],
  },
  {
    key: "hrms",
    title: "HRMS",
    href: "/hrms",
    icon: Users,
    items: [
      { title: "Overview", href: "/hrms", icon: LayoutDashboard },
      { title: "Employees", href: "/hrms/employees", icon: Users },
      { title: "Departments", href: "/hrms/departments", icon: Building2 },
      { title: "Attendance", href: "/hrms/attendance", icon: CalendarDays },
      { title: "Leave", href: "/hrms/leave", icon: Plane },
      { title: "Timesheets", href: "/hrms/timesheets", icon: Clock },
      { title: "Tasks", href: "/hrms/tasks", icon: ListChecks },
      { title: "Payroll", href: "/hrms/payroll", icon: Wallet },
    ],
  },
  {
    key: "vendors",
    title: "Vendor Management",
    href: "/vendors",
    icon: Truck,
    items: [
      { title: "Vendors", href: "/vendors", icon: Truck },
      { title: "Purchase Orders", href: "/vendors/purchase-orders", icon: ClipboardList },
      { title: "Payments", href: "/vendors/payments", icon: Banknote },
    ],
  },
  {
    key: "field",
    title: "GPS & Field Tracking",
    href: "/field",
    icon: MapPin,
    items: [
      { title: "Live Map", href: "/field", icon: MapPinned },
      { title: "Visit History", href: "/field/visits", icon: History },
      { title: "Geofences", href: "/field/geofences", icon: MapPin },
    ],
  },
  {
    key: "finance",
    title: "Finance",
    href: "/finance",
    icon: PiggyBank,
    items: [
      { title: "Expense Claims", href: "/finance", icon: Receipt },
      { title: "Budgets", href: "/finance/budgets", icon: PiggyBank },
    ],
  },
];

export const roleSectionAccess: Record<AccessRole, NavSection["key"][]> = {
  ADMIN: ["crm", "hrms", "vendors", "field", "finance"],
  // Field is listed for SALES so a sales rep who has been granted the field
  // module (Rajvinder) can see and reach GPS & Field Tracking. Listing it here
  // only makes the section *eligible* — visibleSectionsFor() still requires the
  // per-user UserModuleAccess grant, so sales reps without it see nothing new.
  SALES: ["crm", "field"],
  FIELD: ["field"],
  HR: ["hrms"],
  // Procurement is the Proposal Manager's role: Vendors in full, a scoped
  // slice of CRM (see procurementCrmHrefs), and Field for the one who also
  // does site work. As always, the per-user grant still decides.
  PROCUREMENT: ["vendors", "crm", "field"],
  FINANCE: ["finance"],
};

// Role eligibility alone isn't enough to show a nav section: requireModuleAccess()
// also demands a per-user UserModuleAccess grant, so a section listed in
// roleSectionAccess but never granted would render a link that bounces straight
// to /access-denied. Intersecting the two keeps the sidebar honest.
// Procurement's CRM access is scoped to the proposal workflow — the lead
// pipeline and client list they quote against, plus Quotations. The other 4
// CRM pages stay ADMIN/SALES and re-check that themselves. Shared with
// CrmLayout's tab filter so the sidebar and the tabs can't drift apart.
export const procurementCrmHrefs = ["/crm", "/crm/clients", "/crm/quotations"];

export function visibleSectionsFor(
  accessRole: AccessRole,
  grantedModules: string[]
): NavSection[] {
  const eligible = roleSectionAccess[accessRole];
  return navSections
    .filter((s) => eligible.includes(s.key) && grantedModules.includes(s.key))
    // Procurement's CRM grant is a scoped slice (see CrmLayout's matching tab
    // filter) — everyone else sees the section's full item list.
    .map((s) =>
      s.key === "crm" && accessRole === "PROCUREMENT"
        ? { ...s, items: s.items.filter((item) => procurementCrmHrefs.includes(item.href)) }
        : s
    );
}

export const roleHome: Record<AccessRole, string> = {
  ADMIN: "/",
  SALES: "/crm",
  FIELD: "/field",
  HR: "/hrms",
  PROCUREMENT: "/vendors",
  FINANCE: "/finance",
};

export const roleLabel: Record<AccessRole, string> = {
  ADMIN: "Admin",
  SALES: "Sales Rep",
  FIELD: "Field Crew",
  HR: "HR",
  PROCUREMENT: "Procurement",
  FINANCE: "Finance",
};
