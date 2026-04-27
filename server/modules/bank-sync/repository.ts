import { db } from "../../shared/db.js";
import type { PluggyConnection } from "./types.js";

function mapConnection(row: Record<string, unknown>): PluggyConnection {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    pluggyItemId: String(row.pluggy_item_id),
    lastSyncAt: row.last_sync_at ? new Date(String(row.last_sync_at)) : null,
    lastError: row.last_error === null ? null : String(row.last_error),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export async function findConnectionByUserId(userId: number): Promise<PluggyConnection | null> {
  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM pluggy_connections WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return row ? mapConnection(row) : null;
}

export async function upsertConnection(
  userId: number,
  pluggyItemId: string,
): Promise<PluggyConnection> {
  const result = await db.query<Record<string, unknown>>(
    `INSERT INTO pluggy_connections (user_id, pluggy_item_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       pluggy_item_id = EXCLUDED.pluggy_item_id,
       last_error     = NULL,
       updated_at     = NOW()
     RETURNING *`,
    [userId, pluggyItemId],
  );
  return mapConnection(result.rows[0] as Record<string, unknown>);
}

export async function setConnectionSynced(
  userId: number,
  lastError: string | null,
): Promise<void> {
  await db.query(
    `UPDATE pluggy_connections SET last_sync_at = NOW(), last_error = $2, updated_at = NOW()
     WHERE user_id = $1`,
    [userId, lastError],
  );
}

export async function deleteConnection(userId: number): Promise<void> {
  await db.query(`DELETE FROM pluggy_connections WHERE user_id = $1`, [userId]);
}

// ── bank_connections helpers ──────────────────────────────────────────────

export async function findBankConnectionByPluggyAccount(
  userId: number,
  pluggyAccountId: string,
): Promise<{ id: number; accountType: string } | null> {
  const result = await db.query<Record<string, unknown>>(
    `SELECT id, account_type FROM bank_connections
     WHERE user_id = $1 AND pluggy_account_id = $2`,
    [userId, pluggyAccountId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { id: Number(row.id), accountType: String(row.account_type) };
}

export async function upsertBankConnectionForPluggy(
  userId: number,
  pluggyConnectionId: number,
  pluggyAccountId: string,
  name: string,
  accountType: "bank_account" | "credit_card",
  currentBalance: number,
  color: string,
  creditLimit: number | null = null,
  parentBankConnectionId: number | null = null,
): Promise<number> {
  // slug is derived from pluggyAccountId, truncated to be URL-safe
  const slug = `pluggy-${pluggyAccountId.slice(0, 20)}`;

  const result = await db.query<Record<string, unknown>>(
    `INSERT INTO bank_connections
       (user_id, pluggy_connection_id, pluggy_account_id, slug, name, account_type, current_balance, color, connected, credit_limit, parent_bank_connection_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10)
     ON CONFLICT ON CONSTRAINT bank_connections_user_pluggy_account_unique
       DO UPDATE SET
         name                      = EXCLUDED.name,
         current_balance           = EXCLUDED.current_balance,
         pluggy_connection_id      = EXCLUDED.pluggy_connection_id,
         connected                 = TRUE,
         credit_limit              = EXCLUDED.credit_limit,
         parent_bank_connection_id = EXCLUDED.parent_bank_connection_id
     RETURNING id`,
    [userId, pluggyConnectionId, pluggyAccountId, slug, name, accountType, currentBalance, color, creditLimit, parentBankConnectionId],
  );
  return Number((result.rows[0] as Record<string, unknown>).id);
}
