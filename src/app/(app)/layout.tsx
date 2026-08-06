import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TrialBanner } from "@/components/layout/trial-banner";
import { CompleteProfileBanner } from "@/components/layout/complete-profile-banner";
import { getCurrentUser, requireActiveAccess } from "@/lib/dal";
import { getDepartmentOptions } from "@/lib/queries/departments";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user.isSuperAdmin) {
    // Super-admin belongs to no organization — never let it fall through to an
    // org-scoped page where `organizationId!` would be null.
    redirect("/platform-admin");
  }
  const access = await requireActiveAccess();
  // Only needed by the profile banner, which renders only for a user who has no
  // employee record yet — so this stays off the hot path for everyone else.
  const departments = user.employeeId ? [] : await getDepartmentOptions(user.organizationId!);

  return (
    <SidebarProvider>
      <AppSidebar
        accessRole={user.accessRole}
        userName={user.employee?.name ?? user.email}
      />
      <SidebarInset>
        <TrialBanner access={access} />
        {!user.employeeId && <CompleteProfileBanner departments={departments} />}
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
