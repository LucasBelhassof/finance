import pg from "pg";

import { env } from "./env.js";

const { Pool } = pg;

export const db = new Pool({
  connectionString: env.databaseUrl,
});

export async function closeSharedDatabase() {
  await db.end();
}
