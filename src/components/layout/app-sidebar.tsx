"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { navSections, roleSectionAccess, roleLabel } from "@/lib/nav";
import { logout } from "@/lib/actions/auth";
import { initials } from "@/lib/format";
import { Boxes, User, LogOut, ShieldCheck, ClipboardCheck } from "lucide-react";
import type { AccessRole } from "@/generated/prisma/client";

export function AppSidebar({
  accessRole,
  userName,
}: {
  accessRole: AccessRole;
  userName: string;
}) {
  const pathname = usePathname();
  const allowedKeys = roleSectionAccess[accessRole];
  const visibleSections = navSections.filter((s) => allowedKeys.includes(s.key));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Boxes className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Exist Digitally</span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  Ops Platform
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/me"}
                  tooltip="My HR"
                  render={<Link href="/me" />}
                >
                  <User />
                  <span>My HR</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {accessRole === "ADMIN" && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/approvals"}
                      tooltip="Approvals"
                      render={<Link href="/approvals" />}
                    >
                      <ClipboardCheck />
                      <span>Approvals</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/admin")}
                      tooltip="User Management"
                      render={<Link href="/admin/users" />}
                    >
                      <ShieldCheck />
                      <span>User Management</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {visibleSections.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    item.href === section.href
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="size-7">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                    {initials(userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium">{userName}</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {roleLabel[accessRole]}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Signed in as {roleLabel[accessRole]}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <form action={logout}>
                    <DropdownMenuItem
                      nativeButton
                      render={<button type="submit" className="w-full" />}
                    >
                      <LogOut />
                      Log out
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="truncate px-2 py-1.5 text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
          Demo build · sample data
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
