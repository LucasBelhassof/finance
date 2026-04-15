import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarkAllNotificationsAsRead, useMarkNotificationAsRead, useNotifications } from "@/hooks/use-notifications";

export function NotificationBell() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationAsRead();
  const markAllRead = useMarkAllNotificationsAsRead();
  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="relative h-9 w-9 shrink-0 rounded-lg"
        >
          <Bell size={16} className="text-muted-foreground" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-expense px-1 text-[10px] font-semibold text-black">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 border-border/60 bg-card text-foreground" align="end">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notificacoes</span>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void markAllRead.mutateAsync()}
              className="h-7 px-2 text-xs"
            >
              Marcar todas
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/60" />
        {notifications.slice(0, 8).map((notification) => (
          <DropdownMenuItem
            key={String(notification.recipientId)}
            className="flex cursor-pointer flex-col items-start gap-1 whitespace-normal p-3"
            onClick={() => {
              if (!notification.isRead) {
                void markRead.mutateAsync(notification.recipientId);
              }
            }}
          >
            <div className="flex w-full items-center gap-2">
              <p className="text-sm font-medium">{notification.title}</p>
              {!notification.isRead ? <Badge variant="destructive">Nova</Badge> : null}
            </div>
            <p className="text-xs text-muted-foreground">{notification.message}</p>
            <p className="text-[11px] text-muted-foreground">
              {new Date(notification.triggerAt ?? notification.createdAt).toLocaleString("pt-BR")}
            </p>
          </DropdownMenuItem>
        ))}
        {notifications.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Sem notificacoes no momento.</div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
