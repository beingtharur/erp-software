"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/format";

type NotificationItem = {
  id: string;
  message: string;
  href: string | null;
  read: boolean;
  createdAt: Date | string;
};

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [isPending, startTransition] = useTransition();

  function markOne(id: string) {
    startTransition(() => {
      markNotificationRead(id);
    });
  }

  function markAll() {
    startTransition(() => {
      markAllNotificationsRead();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="relative" />}>
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              disabled={isPending}
              onClick={markAll}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto border-t">
          {notifications.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className="relative border-b px-3 py-2.5 last:border-0 hover:bg-accent/50"
            >
              {!n.read && (
                <span className="absolute left-1.5 top-4 size-1.5 rounded-full bg-primary" />
              )}
              <div className="pl-3">
                <p className={n.read ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
                  {n.message}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                  <div className="flex items-center gap-2.5">
                    {n.href && (
                      <Link
                        href={n.href}
                        onClick={() => !n.read && markOne(n.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </Link>
                    )}
                    {!n.read && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => markOne(n.id)}
                        className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
