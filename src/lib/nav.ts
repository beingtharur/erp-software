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
      { title: "Attendance", href: "/hrms/attendance", icon: CalendarDays },
      { title: "Leave", href: "/hrms/leave", icon: Plane },
      { title: "Payroll", href: "/hrms/payroll", icon: Wallet },
      { title: "Timesheets", href: "/hrms/timesheets", icon: Clock },
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
  SALES: ["crm"],
  FIELD: ["field"],
  HR: ["hrms"],
  PROCUREMENT: ["vendors"],
  FINANCE: ["finance"],
};

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
