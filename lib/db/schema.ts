import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Generic key-value store — see design_doc.md §4.11.
// Used initially to hold the encrypted Schwab OAuth token payload (key: "schwab_tokens").
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
