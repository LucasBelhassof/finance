import { Router } from "express";

import {
  createSelfNotification,
  deleteNotificationForUser,
  listNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  markNotificationAsUnread,
} from "./service.js";

function parseRecipientId(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function createNotificationsRouter() {
  const router = Router();

  router.get("/", async (request, response) => {
    const result = await listNotificationsForUser(request.auth!.userId, {
      limit: request.query.limit as string | undefined,
      unreadOnly: request.query.unreadOnly as string | undefined,
      status: request.query.status,
      source: request.query.source,
      startDate: request.query.startDate,
      endDate: request.query.endDate,
    });
    response.json(result);
  });

  router.post("/self", async (request, response) => {
    const notificationId = await createSelfNotification(request.auth!.userId, request.body ?? {});
    response.status(201).json({ notificationId });
  });

  router.patch("/:recipientId/read", async (request, response) => {
    const recipientId = parseRecipientId(request.params.recipientId);

    if (!recipientId) {
      response.status(400).json({
        error: "invalid_notification_recipient_id",
      });
      return;
    }

    await markNotificationAsRead(request.auth!.userId, recipientId);
    response.status(204).send();
  });

  router.patch("/:recipientId/unread", async (request, response) => {
    const recipientId = parseRecipientId(request.params.recipientId);

    if (!recipientId) {
      response.status(400).json({
        error: "invalid_notification_recipient_id",
      });
      return;
    }

    await markNotificationAsUnread(request.auth!.userId, recipientId);
    response.status(204).send();
  });

  router.patch("/read-all", async (request, response) => {
    const result = await markAllNotificationsAsRead(request.auth!.userId);
    response.json(result);
  });

  router.delete("/:recipientId", async (request, response) => {
    const recipientId = parseRecipientId(request.params.recipientId);

    if (!recipientId) {
      response.status(400).json({
        error: "invalid_notification_recipient_id",
      });
      return;
    }

    await deleteNotificationForUser(request.auth!.userId, recipientId);
    response.status(204).send();
  });

  return router;
}
