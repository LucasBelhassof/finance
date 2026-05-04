import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarkAllNotificationsAsRead, useMarkNotificationAsRead, useNotifications } from "@/hooks/use-notifications";
import { appRoutes } from "@/lib/routes";

export function NotificationBell() {
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkNotificationAsRead();
  const markAllRead = useMarkAllNotificationsAsRead();
  const unreadCount = data?.unreadCount ?? 0;
  const unreadNotifications = (data?.notifications ?? []).filter((n) => !n.isRead);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="icon" className="relative h-9 w-9 shrink-0 rounded-lg">
          <Bell size={16} className="text-muted-foreground" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-expense px-1 text-[10px] font-semibold text-black">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="flex w-96 flex-col border-border/60 bg-card p-0 text-foreground" align="end">
        {/* Fixed header */}
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void markAllRead.mutateAsync()}
              className="h-7 px-2 text-xs"
            >
              Marcar todas como lidas
            </Button>
          ) : null}
        </div>
        <div className="shrink-0 border-t border-border/60" />

        {/* Scrollable notification list */}
        <div className="max-h-80 overflow-y-auto">
          {unreadNotifications.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Nenhuma notificação não lida.</div>
          ) : (
            unreadNotifications.map((notification) => (
              <DropdownMenuItem
                key={String(notification.recipientId)}
                className="flex cursor-pointer flex-col items-start gap-1 whitespace-normal rounded-none p-3"
                onClick={() => {
                  void markRead.mutateAsync(notification.recipientId);
                  navigate(notification.actionHref ?? `${appRoutes.notifications}/${notification.recipientId}`);
                }}
              >
                <div className="flex w-full items-center gap-2">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <Badge variant="destructive">Nova</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{notification.message}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(notification.triggerAt ?? notification.createdAt).toLocaleString("pt-BR")}
                </p>
              </DropdownMenuItem>
            ))
          )}
        </div>

        {/* Fixed footer */}
        <div className="shrink-0 border-t border-border/60" />
        <div className="shrink-0 px-1 py-1">
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate(appRoutes.notifications)}>
            Ver central de notificações
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
