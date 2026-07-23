import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getCurrentUser } from "@/lib/dal";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <SidebarProvider>
      <AppSidebar
        accessRole={user.accessRole}
        userName={user.employee?.name ?? user.email}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
