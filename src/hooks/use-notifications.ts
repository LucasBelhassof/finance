import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteNotification,
  getNotifications,
  patchNotificationRead,
  patchNotificationUnread,
  patchReadAllNotifications,
  postSelfNotification,
} from "@/lib/api";
import type { CreateSelfNotificationInput, NotificationsData, NotificationsFilters } from "@/types/api";

export const notificationsQueryKey = ["notifications"] as const;

function buildNotificationsQueryKey(filters: NotificationsFilters = {}) {
  return [...notificationsQueryKey, filters] as const;
}

function updateNotificationCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (current: NotificationsData) => NotificationsData,
) {
  queryClient.setQueriesData<NotificationsData>(
    {
      queryKey: notificationsQueryKey,
    },
    (current) => {
      if (!current) {
        return current;
      }

      return updater(current);
    },
  );
}

export function useNotifications(filters: NotificationsFilters = {}) {
  return useQuery({
    queryKey: buildNotificationsQueryKey(filters),
    queryFn: () => getNotifications(filters),
    staleTime: 15_000,
  });
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: buildNotificationsQueryKey({ limit: 30, status: "unread" }),
    queryFn: () => getNotifications({ limit: 30, status: "unread" }),
    staleTime: 15_000,
  });
}

export function useCreateSelfNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSelfNotificationInput) => postSelfNotification(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipientId: number | string) => patchNotificationRead(recipientId),
    onSuccess: (_, recipientId) => {
      updateNotificationCaches(queryClient, (current) => {
        const notifications = current.notifications.map((item) =>
          String(item.recipientId) === String(recipientId)
            ? {
                ...item,
                isRead: true,
                readAt: item.readAt ?? new Date().toISOString(),
              }
            : item,
        );

        return {
          unreadCount: notifications.filter((item) => !item.isRead).length,
          notifications,
        };
      });
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });
}

export function useMarkNotificationAsUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipientId: number | string) => patchNotificationUnread(recipientId),
    onSuccess: (_, recipientId) => {
      updateNotificationCaches(queryClient, (current) => {
        const notifications = current.notifications.map((item) =>
          String(item.recipientId) === String(recipientId)
            ? {
                ...item,
                isRead: false,
                readAt: null,
              }
            : item,
        );

        return {
          unreadCount: notifications.filter((item) => !item.isRead).length,
          notifications,
        };
      });
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipientId: number | string) => deleteNotification(recipientId),
    onSuccess: (_, recipientId) => {
      updateNotificationCaches(queryClient, (current) => {
        const notifications = current.notifications.filter((item) => String(item.recipientId) !== String(recipientId));

        return {
          unreadCount: notifications.filter((item) => !item.isRead).length,
          notifications,
        };
      });
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => patchReadAllNotifications(),
    onSuccess: () => {
      updateNotificationCaches(queryClient, (current) => ({
        unreadCount: 0,
        notifications: current.notifications.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      }));
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });
}
