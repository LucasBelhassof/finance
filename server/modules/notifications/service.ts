import { db } from "../../shared/db.js";
import { BadRequestError, HttpError } from "../../shared/errors.js";

export type NotificationCategory =
  | "general"
  | "invoice_due"
  | "financing_due"
  | "installment_due"
  | "housing_due"
  | "custom";

export interface NotificationItem {
  recipientId: number;
  notificationId: number;
  title: string;
  message: string;
  category: NotificationCategory;
  source: "user_self" | "admin_all" | "admin_selected";
  triggerAt: string | null;
  createdAt: string;
  isRead: boolean;
  readAt: string | null;
  actionHref: string | null;
  createdBy: {
    id: number;
    name: string;
  } | null;
}

export interface AdminNotificationSummary {
  id: number;
  title: string;
  message: string;
  category: NotificationCategory;
  source: "admin_all" | "admin_selected";
  audience: "all" | "premium" | "non_premium" | "selected";
  triggerAt: string | null;
  createdAt: string;
  recipientsCount: number;
  readCount: number;
}

const ALLOWED_CATEGORIES: NotificationCategory[] = [
  "general",
  "invoice_due",
  "financing_due",
  "installment_due",
  "housing_due",
  "custom",
];

function parseNotificationCategory(value: unknown): NotificationCategory {
  if (typeof value !== "string") {
    return "general";
  }

  return ALLOWED_CATEGORIES.includes(value as NotificationCategory)
    ? (value as NotificationCategory)
    : "general";
}

function parseTriggerAt(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestError("invalid_trigger_at", "The notification trigger date is invalid.");
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError("invalid_trigger_at", "The notification trigger date is invalid.");
  }

  return parsed.toISOString();
}

function normalizeText(value: unknown, field: "title" | "message") {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestError(`invalid_${field}`, `The notification ${field} is required.`);
  }

  const trimmed = value.trim();

  if (field === "title" && trimmed.length > 140) {
    throw new BadRequestError("invalid_title", "The notification title must have at most 140 characters.");
  }

  if (field === "message" && trimmed.length > 1_000) {
    throw new BadRequestError("invalid_message", "The notification message must have at most 1000 characters.");
  }

  return trimmed;
}

function normalizeLimit(limit?: string | number, fallback = 30) {
  const parsed = Number(limit ?? fallback);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function parseNotificationStatusFilter(value: unknown): "all" | "read" | "unread" {
  if (value === "read" || value === "unread") {
    return value;
  }

  return "all";
}

function parseNotificationSourceFilter(value: unknown): "all" | "system" | "user" {
  if (value === "system" || value === "user") {
    return value;
  }

  return "all";
}

function parseDateBoundary(value: unknown, boundary: "start" | "end") {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestError("invalid_notification_date_filter", "The notification date filter is invalid.");
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    throw new BadRequestError("invalid_notification_date_filter", "The notification date filter is invalid.");
  }

  const [, year, month, day] = match;
  const isoValue =
    boundary === "start"
      ? `${year}-${month}-${day}T00:00:00.000Z`
      : `${year}-${month}-${day}T23:59:59.999Z`;
  const parsed = new Date(isoValue);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError("invalid_notification_date_filter", "The notification date filter is invalid.");
  }

  return parsed.toISOString();
}

function mapNotificationRow(row: Record<string, unknown>): NotificationItem {
  return {
    recipientId: Number(row.recipient_id),
    notificationId: Number(row.notification_id),
    title: String(row.title),
    message: String(row.message),
    category: parseNotificationCategory(row.category),
    source: row.source === "admin_all" || row.source === "admin_selected" ? row.source : "user_self",
    triggerAt: row.trigger_at ? new Date(String(row.trigger_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    isRead: Boolean(row.is_read),
    readAt: row.read_at ? new Date(String(row.read_at)).toISOString() : null,
    actionHref: row.action_href ? String(row.action_href) : null,
    createdBy:
      row.created_by_user_id && row.created_by_user_name
        ? {
            id: Number(row.created_by_user_id),
            name: String(row.created_by_user_name),
          }
        : null,
  };
}

async function createNotificationBase(input: {
  createdByUserId: number;
  source: "user_self" | "admin_all" | "admin_selected";
  category: NotificationCategory;
  title: string;
  message: string;
  triggerAt: string | null;
}) {
  const result = await db.query(
    `
      INSERT INTO notifications (
        created_by_user_id,
        source,
        category,
        title,
        message,
        trigger_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
      RETURNING id
    `,
    [
      input.createdByUserId,
      input.source,
      input.category,
      input.title,
      input.message,
      input.triggerAt,
    ],
  );

  return Number(result.rows[0].id);
}

async function insertRecipients(notificationId: number, userIds: number[]) {
  if (userIds.length === 0) {
    throw new BadRequestError("empty_notification_recipients", "At least one recipient is required.");
  }

  await db.query(
    `
      INSERT INTO notification_recipients (notification_id, user_id)
      SELECT $1, recipient_id
      FROM UNNEST($2::int[]) AS recipient_id
      ON CONFLICT (notification_id, user_id) DO NOTHING
    `,
    [notificationId, userIds],
  );
}

export async function listNotificationsForUser(
  userId: number,
  input: {
    limit?: string | number;
    unreadOnly?: string;
    status?: unknown;
    source?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  } = {},
) {
  const limit = normalizeLimit(input.limit);
  const status = input.unreadOnly === "true" ? "unread" : parseNotificationStatusFilter(input.status);
  const source = parseNotificationSourceFilter(input.source);
  const startDate = parseDateBoundary(input.startDate, "start");
  const endDate = parseDateBoundary(input.endDate, "end");

  if (startDate && endDate && startDate > endDate) {
    throw new BadRequestError("invalid_notification_date_range", "The notification date range is invalid.");
  }

  const notificationsResult = await db.query(
    `
      SELECT
        nr.id AS recipient_id,
        n.id AS notification_id,
        n.title,
        n.message,
        n.category,
        n.source,
        n.trigger_at,
        n.action_href,
        n.created_at,
        nr.is_read,
        nr.read_at,
        n.created_by_user_id,
        creator.name AS created_by_user_name
      FROM notification_recipients nr
      INNER JOIN notifications n ON n.id = nr.notification_id
      LEFT JOIN users creator ON creator.id = n.created_by_user_id
      WHERE nr.user_id = $1
        AND (
          $2::text = 'all'
          OR ($2::text = 'read' AND nr.is_read = TRUE)
          OR ($2::text = 'unread' AND nr.is_read = FALSE)
        )
        AND (
          $3::text = 'all'
          OR ($3::text = 'system' AND n.source IN ('admin_all', 'admin_selected'))
          OR ($3::text = 'user' AND n.source = 'user_self')
        )
        AND ($4::timestamptz IS NULL OR COALESCE(n.trigger_at, n.created_at) >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR COALESCE(n.trigger_at, n.created_at) <= $5::timestamptz)
      ORDER BY COALESCE(n.trigger_at, n.created_at) DESC, nr.id DESC
      LIMIT $6
    `,
    [userId, status, source, startDate, endDate, limit],
  );

  const unreadCountResult = await db.query(
    `
      SELECT COUNT(*)::INT AS unread_count
      FROM notification_recipients
      WHERE user_id = $1
        AND is_read = FALSE
    `,
    [userId],
  );

  return {
    unreadCount: Number(unreadCountResult.rows[0]?.unread_count ?? 0),
    notifications: notificationsResult.rows.map((row) => mapNotificationRow(row)),
  };
}

export async function createSelfNotification(
  userId: number,
  input: {
    title: unknown;
    message: unknown;
    category?: unknown;
    triggerAt?: unknown;
  },
) {
  const title = normalizeText(input.title, "title");
  const message = normalizeText(input.message, "message");
  const category = parseNotificationCategory(input.category);
  const triggerAt = parseTriggerAt(input.triggerAt);

  const notificationId = await createNotificationBase({
    createdByUserId: userId,
    source: "user_self",
    category,
    title,
    message,
    triggerAt,
  });

  await insertRecipients(notificationId, [userId]);
  return notificationId;
}

export async function markNotificationAsRead(userId: number, recipientId: number) {
  const result = await db.query(
    `
      UPDATE notification_recipients
      SET is_read = TRUE,
          read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND user_id = $2
      RETURNING id
    `,
    [recipientId, userId],
  );

  if (!result.rows[0]) {
    throw new HttpError(404, "notification_not_found", "The notification was not found.");
  }
}

export async function markNotificationAsUnread(userId: number, recipientId: number) {
  const result = await db.query(
    `
      UPDATE notification_recipients
      SET is_read = FALSE,
          read_at = NULL
      WHERE id = $1
        AND user_id = $2
      RETURNING id
    `,
    [recipientId, userId],
  );

  if (!result.rows[0]) {
    throw new HttpError(404, "notification_not_found", "The notification was not found.");
  }
}

export async function deleteNotificationForUser(userId: number, recipientId: number) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        DELETE FROM notification_recipients
        WHERE id = $1
          AND user_id = $2
        RETURNING notification_id
      `,
      [recipientId, userId],
    );

    const notificationId = result.rows[0]?.notification_id;

    if (!notificationId) {
      throw new HttpError(404, "notification_not_found", "The notification was not found.");
    }

    await client.query(
      `
        DELETE FROM notifications n
        WHERE n.id = $1
          AND NOT EXISTS (
            SELECT 1
            FROM notification_recipients nr
            WHERE nr.notification_id = n.id
          )
      `,
      [notificationId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markAllNotificationsAsRead(userId: number) {
  const result = await db.query(
    `
      UPDATE notification_recipients
      SET is_read = TRUE,
          read_at = COALESCE(read_at, NOW())
      WHERE user_id = $1
        AND is_read = FALSE
      RETURNING id
    `,
    [userId],
  );

  return {
    updatedCount: result.rowCount ?? 0,
  };
}

export async function listAdminNotificationTargets(adminUserId: number) {
  const result = await db.query(
    `
      SELECT id, name, email, status, is_premium
      FROM users
      WHERE id <> $1
        AND status = 'active'
      ORDER BY name ASC, id ASC
      LIMIT 500
    `,
    [adminUserId],
  );

  return {
    users: result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      email: row.email ? String(row.email) : "",
      status:
        row.status === "inactive" || row.status === "suspended"
          ? row.status
          : "active",
      isPremium: Boolean(row.is_premium),
    })),
  };
}

function parseAdminNotificationAudience(value: unknown): "all" | "premium" | "non_premium" {
  if (value === "premium" || value === "non_premium") {
    return value;
  }

  return "all";
}

function normalizeAdminNotificationUserIds(rawUserIds: unknown, adminUserId: number) {
  if (!Array.isArray(rawUserIds)) {
    return [];
  }

  return Array.from(
    new Set(
      rawUserIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0 && value !== adminUserId),
    ),
  );
}

export async function createAdminNotification(
  adminUserId: number,
  input: {
    title: unknown;
    message: unknown;
    category?: unknown;
    triggerAt?: unknown;
    target?: unknown;
  },
) {
  const title = normalizeText(input.title, "title");
  const message = normalizeText(input.message, "message");
  const category = parseNotificationCategory(input.category);
  const triggerAt = parseTriggerAt(input.triggerAt);
  const target =
    typeof input.target === "object" && input.target !== null ? (input.target as { mode?: unknown; audience?: unknown; userIds?: unknown[] }) : {};
  const requestedMode = target.mode === "selected" ? "selected" : "all";
  const targetMode = category === "custom" ? "selected" : requestedMode;
  const targetAudience = parseAdminNotificationAudience(target.audience);

  const source = targetMode === "selected" ? "admin_selected" : "admin_all";
  let recipientUserIds: number[] = [];

  if (targetMode === "all") {
    const premiumFilter =
      targetAudience === "premium" ? true : targetAudience === "non_premium" ? false : null;
    const recipientsResult = await db.query(
      `
        SELECT id
        FROM users
        WHERE id <> $1
          AND status = 'active'
          AND ($2::boolean IS NULL OR is_premium = $2::boolean)
      `,
      [adminUserId, premiumFilter],
    );

    recipientUserIds = recipientsResult.rows.map((row) => Number(row.id));
  } else {
    const normalizedUserIds = normalizeAdminNotificationUserIds(target.userIds, adminUserId);

    if (normalizedUserIds.length === 0) {
      throw new BadRequestError("empty_notification_recipients", "At least one selected user is required.");
    }

    const recipientsResult = await db.query(
      `
        SELECT id
        FROM users
        WHERE id = ANY($1::int[])
          AND status = 'active'
      `,
      [normalizedUserIds],
    );

    recipientUserIds = recipientsResult.rows.map((row) => Number(row.id));

    if (recipientUserIds.length !== normalizedUserIds.length) {
      throw new BadRequestError("invalid_notification_recipient", "Select only active users.");
    }
  }

  if (recipientUserIds.length === 0) {
    throw new BadRequestError("empty_notification_recipients", "No valid recipients were found.");
  }

  const notificationId = await createNotificationBase({
    createdByUserId: adminUserId,
    source,
    category,
    title,
    message,
    triggerAt,
  });

  await insertRecipients(notificationId, recipientUserIds);

  return {
    notificationId,
    recipientsCount: recipientUserIds.length,
  };
}

export async function listAdminNotifications(adminUserId: number, input: { limit?: string | number } = {}) {
  const limit = normalizeLimit(input.limit, 50);

  const result = await db.query(
    `
      SELECT
        n.id,
        n.title,
        n.message,
        n.category,
        n.source,
        CASE
          WHEN n.source = 'admin_selected' THEN 'selected'
          WHEN COUNT(u.id) FILTER (WHERE u.is_premium = TRUE) = COUNT(nr.id) THEN 'premium'
          WHEN COUNT(u.id) FILTER (WHERE u.is_premium = FALSE) = COUNT(nr.id) THEN 'non_premium'
          ELSE 'all'
        END AS audience,
        n.trigger_at,
        n.created_at,
        COUNT(nr.id)::INT AS recipients_count,
        COUNT(nr.id) FILTER (WHERE nr.is_read = TRUE)::INT AS read_count
      FROM notifications n
      INNER JOIN notification_recipients nr ON nr.notification_id = n.id
      INNER JOIN users u ON u.id = nr.user_id
      WHERE n.created_by_user_id = $1
        AND n.source IN ('admin_all', 'admin_selected')
      GROUP BY n.id
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT $2
    `,
    [adminUserId, limit],
  );

  return {
    notifications: result.rows.map((row) => ({
      id: Number(row.id),
      title: String(row.title),
      message: String(row.message),
      category: parseNotificationCategory(row.category),
      source: row.source === "admin_selected" ? "admin_selected" : "admin_all",
      audience:
        row.audience === "premium" || row.audience === "non_premium" || row.audience === "selected"
          ? row.audience
          : "all",
      triggerAt: row.trigger_at ? new Date(String(row.trigger_at)).toISOString() : null,
      createdAt: new Date(String(row.created_at)).toISOString(),
      recipientsCount: Number(row.recipients_count ?? 0),
      readCount: Number(row.read_count ?? 0),
    })) satisfies AdminNotificationSummary[],
  };
}
