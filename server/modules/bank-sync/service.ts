import { db } from "../../shared/db.js";
import { env } from "../../shared/env.js";
import { BadRequestError } from "../../shared/errors.js";
import {
  deleteConnection,
  findConnectionByUserId,
  setConnectionSynced,
  upsertBankConnectionForPluggy,
  upsertConnection,
} from "./repository.js";
import type {
  PluggyAccount,
  PluggyApiKey,
  PluggyConnectionStatus,
  PluggyConnectToken,
  PluggySyncResult,
  PluggyTransaction,
  PluggyTransactionsPage,
} from "./types.js";

const PLUGGY_API = "https://api.pluggy.ai";

// ── Pluggy API helpers ─────────────────────────────────────────────────────

async function getApiKey(): Promise<string> {
  const response = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: env.pluggy.clientId,
      clientSecret: env.pluggy.clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Pluggy auth failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as PluggyApiKey;
  return data.apiKey;
}

async function pluggyGet<T>(apiKey: string, path: string): Promise<T> {
  const response = await fetch(`${PLUGGY_API}${path}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Pluggy GET ${path} failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

// ── Default category helpers ───────────────────────────────────────────────

async function getDefaultExpenseCategoryId(): Promise<number> {
  const result = await db.query<{ id: number }>(
    `SELECT id FROM categories WHERE slug = 'outros-despesas' AND transaction_type = 'expense' LIMIT 1`,
  );
  if (!result.rows[0]) throw new Error("Default expense category not found");
  return result.rows[0].id;
}

async function getDefaultIncomeCategoryId(): Promise<number> {
  const result = await db.query<{ id: number }>(
    `SELECT id FROM categories WHERE slug = 'salario' AND transaction_type = 'income' LIMIT 1`,
  );
  if (!result.rows[0]) throw new Error("Default income category not found");
  return result.rows[0].id;
}

// ── Public service functions ───────────────────────────────────────────────

/** Returns a short-lived Connect Token for the Pluggy Connect Widget. */
export async function createConnectToken(userId: number): Promise<string> {
  if (!env.pluggy.clientId || !env.pluggy.clientSecret) {
    throw new BadRequestError("pluggy_not_configured", "Pluggy integration is not configured.");
  }

  const apiKey = await getApiKey();

  const response = await fetch(`${PLUGGY_API}/connect_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ clientUserId: String(userId) }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Pluggy connect_token failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as PluggyConnectToken;
  return data.accessToken;
}

/** Saves a Pluggy item connection for a user and triggers an initial sync. */
export async function connectItem(
  userId: number,
  pluggyItemId: string,
): Promise<PluggySyncResult> {
  await upsertConnection(userId, pluggyItemId);
  return syncTransactions(userId);
}

/** Returns the current Pluggy connection status for a user. */
export async function getConnectionStatus(userId: number): Promise<PluggyConnectionStatus> {
  const connection = await findConnectionByUserId(userId);

  if (!connection) {
    return { connected: false, lastSyncAt: null, lastError: null, pluggyItemId: null };
  }

  return {
    connected: true,
    lastSyncAt: connection.lastSyncAt ? connection.lastSyncAt.toISOString() : null,
    lastError: connection.lastError,
    pluggyItemId: connection.pluggyItemId,
  };
}

/** Syncs all accounts and transactions from Pluggy for a user. */
export async function syncTransactions(userId: number): Promise<PluggySyncResult> {
  const connection = await findConnectionByUserId(userId);

  if (!connection) {
    throw new BadRequestError("no_pluggy_connection", "No Pluggy connection found.");
  }

  let imported = 0;
  let skipped = 0;

  try {
    const apiKey = await getApiKey();
    const accounts = await pluggyGet<{ total: number; results: PluggyAccount[] }>(
      apiKey,
      `/accounts?itemId=${connection.pluggyItemId}`,
    );

    const [defaultExpenseCategoryId, defaultIncomeCategoryId] = await Promise.all([
      getDefaultExpenseCategoryId(),
      getDefaultIncomeCategoryId(),
    ]);

    // Pass 1: upsert BANK accounts first so credit cards can reference them as parent
    let parentBankConnectionId: number | null = null;
    const bankAccounts = accounts.results.filter((a) => a.type !== "CREDIT");
    for (const account of bankAccounts) {
      const id = await upsertBankConnectionForPluggy(
        userId,
        connection.id,
        account.id,
        account.marketingName ?? account.name,
        "bank_account",
        account.balance,
        "bg-blue-500",
      );
      // Use the first bank account as parent for credit cards in this item
      if (parentBankConnectionId === null) parentBankConnectionId = id;
    }

    // Pass 2: upsert CREDIT accounts linked to the parent bank account
    const creditAccounts = accounts.results.filter((a) => a.type === "CREDIT");
    for (const account of creditAccounts) {
      await upsertBankConnectionForPluggy(
        userId,
        connection.id,
        account.id,
        account.marketingName ?? account.name,
        "credit_card",
        account.balance,
        "bg-purple-500",
        account.creditData?.creditLimit ?? null,
        parentBankConnectionId,
      );
    }

    // Pass 3: import transactions for all accounts
    for (const account of accounts.results) {
      const accountType = account.type === "CREDIT" ? "credit_card" : "bank_account";

      // Resolve the bankConnectionId already upserted above
      const bankConnectionId = await upsertBankConnectionForPluggy(
        userId,
        connection.id,
        account.id,
        account.marketingName ?? account.name,
        accountType,
        account.balance,
        accountType === "credit_card" ? "bg-purple-500" : "bg-blue-500",
        accountType === "credit_card" ? (account.creditData?.creditLimit ?? null) : null,
        accountType === "credit_card" ? parentBankConnectionId : null,
      );

      // Fetch up to 500 most recent transactions (paginated)
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const txPage = await pluggyGet<PluggyTransactionsPage>(
          apiKey,
          `/transactions?accountId=${account.id}&pageSize=100&page=${page}`,
        );

        totalPages = txPage.totalPages;

        for (const tx of txPage.results) {
          const result = await importTransaction(
            userId,
            bankConnectionId,
            tx,
            accountType,
            defaultExpenseCategoryId,
            defaultIncomeCategoryId,
          );
          if (result) imported++;
          else skipped++;
        }

        page++;
        if (page > 5) break; // cap at 500 transactions per account on initial sync
      }
    }

    await setConnectionSynced(userId, null);

    return { imported, skipped, accounts: accounts.results.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setConnectionSynced(userId, message);
    throw error;
  }
}

/** Removes the Pluggy connection for a user. Does not affect existing transactions. */
export async function disconnectPluggy(userId: number): Promise<void> {
  await deleteConnection(userId);
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Inserts a single Pluggy transaction using seed_key for deduplication.
 * Returns true if inserted, false if skipped (duplicate).
 */
async function importTransaction(
  userId: number,
  bankConnectionId: number,
  tx: PluggyTransaction,
  accountType: string,
  defaultExpenseCategoryId: number,
  defaultIncomeCategoryId: number,
): Promise<boolean> {
  // Pluggy amounts are always positive; sign is in the `type` field
  const isCredit = tx.type === "CREDIT";

  // Credit cards: credits reduce the bill (negative), debits increase it (positive expenses)
  // Bank accounts: credits are income (positive), debits are expenses (negative)
  let amount: number;
  let categoryId: number;

  if (accountType === "credit_card") {
    // On credit cards all transactions are expenses unless it's a payment/refund
    amount = isCredit ? tx.amount : -Math.abs(tx.amount);
    categoryId = defaultExpenseCategoryId;
  } else {
    amount = isCredit ? Math.abs(tx.amount) : -Math.abs(tx.amount);
    categoryId = isCredit ? defaultIncomeCategoryId : defaultExpenseCategoryId;
  }

  const seedKey = `pluggy:${tx.id}`;
  const occurredOn = tx.date.slice(0, 10); // ISO date YYYY-MM-DD

  const result = await db.query<{ id: number }>(
    `INSERT INTO transactions
       (user_id, bank_connection_id, category_id, description, amount, occurred_on, seed_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, seed_key) DO NOTHING
     RETURNING id`,
    [userId, bankConnectionId, categoryId, tx.description, amount, occurredOn, seedKey],
  );

  return (result.rowCount ?? 0) > 0;
}
