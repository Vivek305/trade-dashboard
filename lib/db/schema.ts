import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  numeric,
  jsonb,
  timestamp,
  boolean,
  date,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";

// Generic key-value store — see design_doc.md §4.11.
// Used initially to hold the encrypted Schwab OAuth token payload (key: "schwab_tokens").
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Linked Schwab account(s) — see design_doc.md §4.1.
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  schwabAccountHash: text("schwab_account_hash").notNull().unique(),
  nickname: text("nickname"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Periodic account value for the equity curve — see design_doc.md §4.2.
export const accountSnapshots = pgTable("account_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id),
  snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull(),
  netLiq: numeric("net_liq", { precision: 14, scale: 2 }),
  cashBalance: numeric("cash_balance", { precision: 14, scale: 2 }),
  buyingPower: numeric("buying_power", { precision: 14, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Controlled setup/mistake taxonomy — see design_doc.md §4.5.
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    category: text("category").notNull(), // 'setup' | 'mistake'
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("tags_name_category_unique").on(table.name, table.category)]
);

// Free-form daily/weekly/monthly reflection — see design_doc.md §4.8.
export const dailyJournal = pgTable("daily_journal", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryDate: date("entry_date").notNull().unique(),
  entryType: text("entry_type").default("daily"), // 'daily' | 'weekly' | 'monthly'
  marketBiasNote: text("market_bias_note"),
  generalNotes: text("general_notes"),
  mood: text("mood"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Core table — one row per logical position (e.g. one credit spread) — see design_doc.md §4.3.
export const trades = pgTable(
  "trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").references(() => accounts.id),

    // Auto-populated from Schwab
    underlying: text("underlying").notNull(),
    instrumentType: text("instrument_type").notNull(), // 'equity' | 'single_option' | 'vertical_spread' | 'other'
    strategyLabel: text("strategy_label"), // 'CCS' | 'PCS' — derived from legs
    dte: smallint("dte"),
    entryDatetime: timestamp("entry_datetime", { withTimezone: true }).notNull(),
    exitDatetime: timestamp("exit_datetime", { withTimezone: true }),
    entryPrice: numeric("entry_price", { precision: 10, scale: 4 }),
    exitPrice: numeric("exit_price", { precision: 10, scale: 4 }),
    quantity: integer("quantity").notNull(),
    realizedPnl: numeric("realized_pnl", { precision: 12, scale: 2 }),
    fees: numeric("fees", { precision: 10, scale: 2 }).default("0"),
    status: text("status").notNull().default("open"), // 'open' | 'closed'
    schwabOrderIds: jsonb("schwab_order_ids"), // array of order/transaction IDs making up this trade

    // Position sizing / risk
    positionSizePct: numeric("position_size_pct", { precision: 5, scale: 2 }),
    maxRisk: numeric("max_risk", { precision: 12, scale: 2 }),

    // Market context — denormalized copies for fast dashboard queries (full detail in market_snapshots)
    vixAtEntry: numeric("vix_at_entry", { precision: 6, scale: 2 }),
    vixAtExit: numeric("vix_at_exit", { precision: 6, scale: 2 }),
    underlyingPriceAtEntry: numeric("underlying_price_at_entry", { precision: 10, scale: 2 }),
    underlyingPriceAtExit: numeric("underlying_price_at_exit", { precision: 10, scale: 2 }),

    // Manual fields
    setupTagId: uuid("setup_tag_id").references(() => tags.id),
    mistakeTagId: uuid("mistake_tag_id").references(() => tags.id),
    confidenceLevel: smallint("confidence_level"), // 1-5
    htfBias: text("htf_bias"), // 'bullish' | 'bearish' | 'neutral'
    levelsUsed: text("levels_used"),
    reasoning: text("reasoning"),
    plannedExit: text("planned_exit"),
    realizedVsPlanned: text("realized_vs_planned"), // 'per_plan' | 'early' | 'late' | 'stopped_out' | 'other'
    emotionalState: text("emotional_state"), // 'calm' | 'anxious' | 'fomo' | 'tilted' | 'confident' | other
    highImpactNewsDay: boolean("high_impact_news_day").default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_trades_entry_datetime").on(table.entryDatetime),
    index("idx_trades_underlying").on(table.underlying),
    index("idx_trades_setup_tag").on(table.setupTagId),
  ]
);

// Individual option legs belonging to a trade — see design_doc.md §4.4.
export const tradeLegs = pgTable(
  "trade_legs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tradeId: uuid("trade_id").references(() => trades.id, { onDelete: "cascade" }),
    optionSymbol: text("option_symbol").notNull(), // OCC symbol
    right: text("right").notNull(), // 'call' | 'put'
    strike: numeric("strike", { precision: 10, scale: 2 }).notNull(),
    expiration: date("expiration").notNull(),
    action: text("action").notNull(), // 'sell_to_open' | 'buy_to_open' | 'buy_to_close' | 'sell_to_close'
    quantity: integer("quantity").notNull(),
    price: numeric("price", { precision: 10, scale: 4 }),
    greeksAtEntry: jsonb("greeks_at_entry"), // { delta, theta, vega, gamma, iv }
    greeksAtExit: jsonb("greeks_at_exit"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_legs_trade_id").on(table.tradeId)]
);

// Attaches to a trade or a daily journal entry — see design_doc.md §4.6.
export const screenshots = pgTable(
  "screenshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tradeId: uuid("trade_id").references(() => trades.id, { onDelete: "cascade" }),
    journalEntryId: uuid("journal_entry_id").references(() => dailyJournal.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(), // object storage path
    caption: text("caption"),
    screenshotType: text("screenshot_type"), // 'entry' | 'exit' | 'management' | 'reference'
    takenAt: timestamp("taken_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_screenshots_trade_id").on(table.tradeId),
    check(
      "screenshots_trade_or_journal_check",
      sql`${table.tradeId} IS NOT NULL OR ${table.journalEntryId} IS NOT NULL`
    ),
  ]
);

// Underlying/VIX OHLC context around a trade's entry/exit, captured once at sync time — see design_doc.md §4.7.
export const marketSnapshots = pgTable("market_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradeId: uuid("trade_id").references(() => trades.id, { onDelete: "cascade" }),
  snapshotType: text("snapshot_type").notNull(), // 'entry' | 'exit'
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  underlyingOhlc: jsonb("underlying_ohlc"), // { open, high, low, close, volume }
  vixValue: numeric("vix_value", { precision: 6, scale: 2 }),
  rsiValue: numeric("rsi_value", { precision: 6, scale: 2 }),
  rawBars: jsonb("raw_bars"), // optional surrounding bars for later chart reconstruction
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Macro and options-specific calendar — see design_doc.md §4.9.
export const econEvents = pgTable(
  "econ_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventName: text("event_name").notNull(), // 'CPI', 'FOMC Rate Decision', 'Monthly Opex', ...
    eventDatetime: timestamp("event_datetime", { withTimezone: true }).notNull(),
    category: text("category").notNull(), // 'macro' | 'fed' | 'options_expiry' | 'earnings' | 'other'
    impactLevel: text("impact_level"), // 'high' | 'medium' | 'low'
    actualValue: text("actual_value"),
    forecastValue: text("forecast_value"),
    previousValue: text("previous_value"),
    source: text("source"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_econ_events_datetime").on(table.eventDatetime)]
);

// Tracks sync runs and cursors for incremental sync — see design_doc.md §4.10.
export const syncLog = pgTable("sync_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  syncType: text("sync_type").notNull(), // 'positions' | 'account_snapshot' | 'econ_calendar'
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: text("status"), // 'success' | 'partial' | 'failed'
  recordsAdded: integer("records_added").default(0),
  recordsUpdated: integer("records_updated").default(0),
  errorMessage: text("error_message"),
  cursorValue: text("cursor_value"), // last transaction ID or ISO timestamp synced through
});
