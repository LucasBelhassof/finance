import { db } from "../../shared/db.js";

function parseNumeric(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateInput(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toISOString().slice(0, 10);
}

export interface AdminDateRangeInput {
  startDate?: string;
  endDate?: string;
}

export async function getAdminOverview(input: AdminDateRangeInput = {}) {
  const endDate = normalizeDateInput(input.endDate, new Date().toISOString().slice(0, 10));
  const startDate = normalizeDateInput(
    input.startDate,
    new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
  );

  const [countsResult, sessionsResult, transactionsResult, signupsResult] = await Promise.all([
    db.query(
      `
        SELECT
          COUNT(*)::INT AS total_users,
          COUNT(*) FILTER (WHERE status = 'active')::INT AS active_users,
          COUNT(*) FILTER (WHERE is_premium = TRUE)::INT AS premium_users,
          COUNT(*) FILTER (WHERE is_premium = FALSE)::INT AS free_users
        FROM users
      `,
    ),
    db.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE revoked_at IS NULL
              AND expires_at > NOW()
          )::INT AS active_sessions,
          COUNT(*) FILTER (
            WHERE revoked_at IS NULL
              AND expires_at > NOW()
              AND COALESCE(last_used_at, created_at) >= NOW() - INTERVAL '15 minutes'
          )::INT AS users_online_now
        FROM auth_sessions
      `,
    ),
    db.query(
      `
        SELECT
          COUNT(*)::INT AS total_transactions,
          COALESCE(SUM(amount), 0)::NUMERIC(14, 2) AS aggregate_balance
        FROM transactions
      `,
    ),
    db.query(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date,
          COUNT(*)::INT AS total
        FROM users
        WHERE created_at::date BETWEEN $1::date AND $2::date
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [startDate, endDate],
    ),
  ]);

  const counts = countsResult.rows[0];
  const sessions = sessionsResult.rows[0];
  const transactions = transactionsResult.rows[0];

  return {
    totals: {
      totalUsers: Number(counts.total_users ?? 0),
      activeUsers: Number(counts.active_users ?? 0),
      premiumUsers: Number(counts.premium_users ?? 0),
      freeUsers: Number(counts.free_users ?? 0),
      usersOnlineNow: Number(sessions.users_online_now ?? 0),
      activeSessions: Number(sessions.active_sessions ?? 0),
      totalTransactions: Number(transactions.total_transactions ?? 0),
      aggregateBalance: parseNumeric(transactions.aggregate_balance),
    },
    period: {
      startDate,
      endDate,
    },
    signups: signupsResult.rows.map((row) => ({
      date: String(row.date),
      total: Number(row.total ?? 0),
    })),
  };
}

export async function getAdminFinancialMetrics(input: AdminDateRangeInput = {}) {
  const endDate = normalizeDateInput(input.endDate, new Date().toISOString().slice(0, 10));
  const startDate = normalizeDateInput(
    input.startDate,
    new Date(Date.now() - 179 * 86400000).toISOString().slice(0, 10),
  );

  const [summaryResult, monthlySeriesResult, topUsersResult] = await Promise.all([
    db.query(
      `
        WITH ranged_transactions AS (
          SELECT user_id, amount
          FROM transactions
          WHERE occurred_on BETWEEN $1::date AND $2::date
        ),
        user_ticket AS (
          SELECT user_id, AVG(ABS(amount))::NUMERIC(14, 2) AS average_ticket
          FROM ranged_transactions
          GROUP BY user_id
        )
        SELECT
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::NUMERIC(14, 2) AS total_income,
          COALESCE(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 0)::NUMERIC(14, 2) AS total_expenses,
          COALESCE(SUM(amount), 0)::NUMERIC(14, 2) AS aggregate_balance,
          COALESCE((SELECT AVG(average_ticket) FROM user_ticket), 0)::NUMERIC(14, 2) AS average_ticket_per_user,
          COUNT(*)::INT AS transaction_count
        FROM ranged_transactions
      `,
      [startDate, endDate],
    ),
    db.query(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('month', occurred_on), 'YYYY-MM') AS month,
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::NUMERIC(14, 2) AS income,
          COALESCE(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 0)::NUMERIC(14, 2) AS expenses,
          COALESCE(SUM(ABS(amount)), 0)::NUMERIC(14, 2) AS volume,
          COUNT(*)::INT AS transactions
        FROM transactions
        WHERE occurred_on BETWEEN $1::date AND $2::date
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [startDate, endDate],
    ),
    db.query(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          COUNT(t.*)::INT AS transaction_count,
          COALESCE(SUM(ABS(t.amount)), 0)::NUMERIC(14, 2) AS transacted_volume
        FROM users u
        INNER JOIN transactions t ON t.user_id = u.id
        WHERE t.occurred_on BETWEEN $1::date AND $2::date
        GROUP BY u.id, u.name, u.email
        ORDER BY transaction_count DESC, transacted_volume DESC
        LIMIT 5
      `,
      [startDate, endDate],
    ),
  ]);

  const summary = summaryResult.rows[0];

  return {
    period: {
      startDate,
      endDate,
    },
    summary: {
      totalIncome: parseNumeric(summary.total_income),
      totalExpenses: parseNumeric(summary.total_expenses),
      aggregateBalance: parseNumeric(summary.aggregate_balance),
      averageTicketPerUser: parseNumeric(summary.average_ticket_per_user),
      transactionCount: Number(summary.transaction_count ?? 0),
    },
    monthlySeries: monthlySeriesResult.rows.map((row) => ({
      month: String(row.month),
      income: parseNumeric(row.income),
      expenses: parseNumeric(row.expenses),
      volume: parseNumeric(row.volume),
      transactions: Number(row.transactions ?? 0),
    })),
    topUsers: topUsersResult.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      email: row.email ? String(row.email) : "",
      transactionCount: Number(row.transaction_count ?? 0),
      transactedVolume: parseNumeric(row.transacted_volume),
    })),
  };
}

export async function getAdminSubscriptionMetrics(input: AdminDateRangeInput = {}) {
  const endDate = normalizeDateInput(input.endDate, new Date().toISOString().slice(0, 10));
  const startDate = normalizeDateInput(
    input.startDate,
    new Date(Date.now() - 179 * 86400000).toISOString().slice(0, 10),
  );

  const [summaryResult, evolutionResult] = await Promise.all([
    db.query(
      `
        SELECT
          COUNT(*)::INT AS total_users,
          COUNT(*) FILTER (WHERE is_premium = TRUE)::INT AS premium_users,
          COUNT(*) FILTER (WHERE is_premium = FALSE)::INT AS free_users
        FROM users
      `,
    ),
    db.query(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('month', premium_since), 'YYYY-MM') AS month,
          COUNT(*)::INT AS premium_activations
        FROM users
        WHERE is_premium = TRUE
          AND premium_since IS NOT NULL
          AND premium_since::date BETWEEN $1::date AND $2::date
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [startDate, endDate],
    ),
  ]);

  const summary = summaryResult.rows[0];
  const totalUsers = Number(summary.total_users ?? 0);
  const premiumUsers = Number(summary.premium_users ?? 0);
  const freeUsers = Number(summary.free_users ?? 0);
  const conversionRate = totalUsers > 0 ? premiumUsers / totalUsers : 0;
  const estimatedMrr = premiumUsers * 29.9;

  return {
    period: {
      startDate,
      endDate,
    },
    summary: {
      totalUsers,
      premiumUsers,
      freeUsers,
      conversionRate,
      estimatedSubscriptionRevenue: estimatedMrr,
      estimatedMrr,
    },
    evolution: evolutionResult.rows.map((row) => ({
      month: String(row.month),
      premiumActivations: Number(row.premium_activations ?? 0),
    })),
  };
}

export async function getAdminActivity(input: { limit?: number | string } = {}) {
  const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 100);

  const result = await db.query(
    `
      SELECT
        e.id,
        e.event_type,
        e.success,
        e.created_at,
        e.email,
        u.id AS user_id,
        u.name AS user_name,
        u.role AS user_role
      FROM auth_audit_events e
      LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return {
    events: result.rows.map((row) => ({
      id: Number(row.id),
      eventType: String(row.event_type),
      success: Boolean(row.success),
      createdAt: new Date(String(row.created_at)).toISOString(),
      email: row.email ? String(row.email) : null,
      user: row.user_id
        ? {
            id: Number(row.user_id),
            name: String(row.user_name),
            role: row.user_role === "admin" ? "admin" : "user",
          }
        : null,
    })),
  };
}

export async function getAdminUsers(input: {
  page?: number | string;
  pageSize?: number | string;
  status?: string;
  premium?: string;
  recentActivity?: string;
}) {
  const page = Math.max(Number(input.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(input.pageSize ?? 20), 1), 100);
  const offset = (page - 1) * pageSize;
  const values: Array<string | number | boolean> = [];
  const filters: string[] = [];

  if (input.status === "active" || input.status === "inactive" || input.status === "suspended") {
    values.push(input.status);
    filters.push(`u.status = $${values.length}`);
  }

  if (input.premium === "true" || input.premium === "false") {
    values.push(input.premium === "true");
    filters.push(`u.is_premium = $${values.length}`);
  }

  if (input.recentActivity === "recent") {
    filters.push(`COALESCE(last_session.last_seen_at, u.created_at) >= NOW() - INTERVAL '30 days'`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  values.push(pageSize, offset);

  const result = await db.query(
    `
      WITH last_session AS (
        SELECT
          user_id,
          MAX(COALESCE(last_used_at, created_at)) AS last_seen_at
        FROM auth_sessions
        GROUP BY user_id
      ),
      user_metrics AS (
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.status,
          u.is_premium,
          u.created_at,
          u.premium_since,
          last_session.last_seen_at,
          COUNT(t.*)::INT AS transaction_count,
          COALESCE(SUM(t.amount), 0)::NUMERIC(14, 2) AS net_total
        FROM users u
        LEFT JOIN last_session ON last_session.user_id = u.id
        LEFT JOIN transactions t ON t.user_id = u.id
        ${whereClause}
        GROUP BY u.id, last_session.last_seen_at
      )
      SELECT
        *,
        COUNT(*) OVER()::INT AS total_count
      FROM user_metrics
      ORDER BY created_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values,
  );

  const total = Number(result.rows[0]?.total_count ?? 0);

  return {
    page,
    pageSize,
    total,
    users: result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      email: row.email ? String(row.email) : "",
      role: row.role === "admin" ? "admin" : "user",
      status:
        row.status === "inactive" || row.status === "suspended"
          ? row.status
          : "active",
      isPremium: Boolean(row.is_premium),
      createdAt: new Date(String(row.created_at)).toISOString(),
      premiumSince: row.premium_since ? new Date(String(row.premium_since)).toISOString() : null,
      lastSessionAt: row.last_seen_at ? new Date(String(row.last_seen_at)).toISOString() : null,
      transactionCount: Number(row.transaction_count ?? 0),
      netTotal: parseNumeric(row.net_total),
    })),
  };
}
