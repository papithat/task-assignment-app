import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { resolveSecretEnv } from "../secrets";

// If PGPASSWORD_FILE (a Docker/Kubernetes secret mount) is set, this reads it
// into process.env.PGPASSWORD so the `pg` library's own env-var handling picks
// it up automatically below — no plaintext password needs to live in the
// compose file or shell environment.
resolveSecretEnv("PGPASSWORD");

// If DATABASE_URL is set (e.g. for simple local dev), use it directly.
// Otherwise fall back to the discrete PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
// env vars, which node-postgres reads automatically when no config is passed.
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool();

/**
 * Runs schema.sql then seed.sql on startup.
 * Both files are written to be idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING),
 * so it's safe to run this every time the container starts.
 */
export async function migrateAndSeed(): Promise<void> {
  const schemaPath = path.join(__dirname, "schema.sql");
  const seedPath = path.join(__dirname, "seed.sql");

  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  const seedSql = fs.readFileSync(seedPath, "utf-8");

  const client = await pool.connect();
  try {
    await client.query(schemaSql);
    await client.query(seedSql);
    console.log("[db] schema migrated and seed data ensured");
  } finally {
    client.release();
  }
}

/** Simple retry wrapper since the backend may start before postgres is fully ready. */
export async function waitForDb(retries = 20, delayMs = 1500): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      console.log(`[db] not ready yet (attempt ${attempt}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Database did not become ready in time");
}
