import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getNotifications,
  patchNotificationRead,
  patchReadAllNotifications,
  postSelfNotification,
} from "@/lib/api";
import type { CreateSelfNotificationInput, NotificationsData } from "@/types/api";

export const notificationsQueryKey = ["notifications"] as const;

export function useNotifications() {
  return useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => getNotifications(30),
    staleTime: 15_000,
  });
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: [...notificationsQueryKey, "unread"],
    queryFn: () => getNotifications(30, true),
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
      queryClient.setQueryData<NotificationsData | undefined>(notificationsQueryKey, (current) => {
        if (!current) {
          return current;
        }

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
          unreadCount: Math.max(
            notifications.filter((item) => !item.isRead).length,
            0,
          ),
          notifications,
        };
      });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => patchReadAllNotifications(),
    onSuccess: () => {
      queryClient.setQueryData<NotificationsData | undefined>(notificationsQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          unreadCount: 0,
          notifications: current.notifications.map((item) => ({
            ...item,
            isRead: true,
            readAt: item.readAt ?? new Date().toISOString(),
          })),
        };
      });
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });
}
