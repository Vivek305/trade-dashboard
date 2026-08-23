/**
 * Runtime database migration runner.
 *
 * Applies pending Drizzle migrations (from ./drizzle) programmatically, without
 * depending on the drizzle-kit CLI. This is what lets us run migrations "on boot"
 * as a single deploy step — locally (`npm run db:up` or automatically on server
 * start) or inside a container entrypoint.
 *
 * NOTE: migrations are idempotent — drizzle records applied migrations in a
 * `drizzle.__drizzle_migrations` meta table and only applies new ones, so it is
 * safe to run on every boot.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in."
  );
  process.exit(1);
}

// The migrations live in /drizzle at the repo root; resolve robustly regardless of CWD.
const migrationsFolder = path.resolve(process.cwd(), "drizzle");

async function runMigrations(): Promise<void> {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    console.log(`[migrate] Applying migrations from ${migrationsFolder} …`);
    await migrate(db, { migrationsFolder });
    console.log("[migrate] Migrations up to date.");
  } finally {
    await client.end();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[migrate] Failed to apply migrations:", err);
    process.exit(1);
  });
