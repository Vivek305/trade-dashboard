/**
 * Seeds the initial `tags` taxonomy (design_doc.md §4.5) so the UI has real
 * setup/mistake tags to work with instead of the hardcoded `lib/data.ts` list.
 *
 * Idempotent: uses the `tags_name_category_unique` constraint to upsert, so it's
 * safe to re-run (e.g. on every deploy, alongside migrations).
 *
 * Run with: npm run db:seed
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

// Mirrors lib/data.ts TAGS — the same seven demo tags the static UI currently renders.
const SEED_TAGS: { name: string; category: "setup" | "mistake"; color: string }[] = [
  { name: "Key Level Rejection", category: "setup", color: "#34d399" },
  { name: "Trend Pullback", category: "setup", color: "#38bdf8" },
  { name: "Momentum Breakout", category: "setup", color: "#a78bfa" },
  { name: "Volatility Fade", category: "setup", color: "#fbbf24" },
  { name: "Entered on news", category: "mistake", color: "#f43f5e" },
  { name: "Oversized position", category: "mistake", color: "#fb923c" },
  { name: "Managed too late", category: "mistake", color: "#f87171" },
];

async function seed(): Promise<void> {
  const client = postgres(connectionString!, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    await db
      .insert(schema.tags)
      .values(SEED_TAGS)
      .onConflictDoUpdate({
        target: [schema.tags.name, schema.tags.category],
        set: { color: sql`excluded.color` },
      });
    console.log(`[seed] Upserted ${SEED_TAGS.length} tags.`);
  } finally {
    await client.end();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] Failed to seed:", err);
    process.exit(1);
  });
