import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/layout/notification-bell";
import { getCurrentUser } from "@/lib/dal";
import { getMyNotifications } from "@/lib/queries/notifications";

export async function SiteHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const user = await getCurrentUser();
  const { notifications, unreadCount } = await getMyNotifications(user.id);

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <div className="flex-1 min-w-0">
        <h1 className="truncate text-base font-semibold leading-none">{title}</h1>
        {description ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Badge variant="outline" className="hidden sm:inline-flex text-xs font-normal text-muted-foreground">
        Sample data · demo environment
      </Badge>
      <NotificationBell notifications={notifications} unreadCount={unreadCount} />
    </header>
  );
}
