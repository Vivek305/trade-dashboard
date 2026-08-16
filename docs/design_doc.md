# Trading Journal Web App — Design Document

**Owner:** Personal use, single-user
**Purpose:** Unify live trade tracking (via Schwab API), discretionary journaling, screenshots, market context, and economic calendar into one reviewable system for SPY/SPX/ES key-level trading.

---

## 1. Goals & Non-Goals

**Goals**
- Auto-pull closed/open positions from Schwab (grouped into logical trades, not raw legs)
- Let the user manually enrich every trade with tags, reasoning, screenshots, confidence, mistake type
- Visualize performance: equity curve, drawdown, win rate, P&L breakdowns by setup/time/instrument
- Track economic events and options-specific dates (opex, triple witching, VIX expiration)
- Support daily/weekly reflection journaling, independent of individual trades
- Be reviewable months later with zero data loss (screenshots, price/VIX context, reasoning all preserved)
- Sync manually (end-of-day trigger) — no requirement for real-time/live sync

**Non-Goals (for v1)**
- Not a live trading/order-execution tool — read-only against Schwab (no order placement)
- Not multi-user — no need for role-based access, teams, sharing
- Not a backtesting engine — replay/backtesting stays in the separate Notion workflow for now (schema leaves room to merge later)

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + backend | **Next.js (App Router, TypeScript)** | Single framework for UI + API routes/server actions; easy to host; good fit for a personal full-stack app without standing up a separate backend service |
| UI components | **shadcn/ui** (Radix + Tailwind CSS) | Clean, modern, dark-mode-first, highly customizable cards/tables/dialogs — fits the "visually appealing, card-based dashboard" requirement well |
| Dashboard-specific components | **Tremor** (Tailwind-based, built for dashboards) | Purpose-built KPI cards, area/bar charts, and layouts — pairs naturally with shadcn for the stats/chart-heavy dashboard view |
| Charting (custom charts) | **Recharts** | React-native charting, flexible enough for equity curve, P&L histograms, breakdown charts not covered by Tremor's presets |
| Calendar heatmap | **cal-heatmap** or **react-calendar-heatmap** | GitHub-style daily P&L heatmap |
| Database | **PostgreSQL** | Handles concurrent access, JSONB for flexible fields (Greeks, snapshots), strong time-series aggregation support |
| ORM | **Drizzle ORM** (or Prisma if you prefer more tooling/GUI) | Type-safe schema-as-code, lightweight, works well with Next.js server actions |
| Hosted DB + object storage | **Supabase** | Gives Postgres + file storage (screenshots) + auth in one provider — minimal infra to manage for a personal project |
| Object storage (alt.) | Cloudflare R2 or AWS S3 | If you prefer not to bundle storage with Supabase |
| Auth | Simple single-user password gate (NextAuth Credentials provider, or even a basic middleware password) | No need for full multi-user auth — keep this lightweight |
| Hosting | **Vercel** (frontend/API) + **Supabase** (DB/storage) | Free/cheap tier sufficient for personal volume; scheduled/manual sync via a server action or Vercel Cron |
| Broker data | **Schwab Trader API** (OAuth) | Positions, transactions, price history, options chain/Greeks |
| Market/econ data | Secondary source — e.g. **FMP**, **Finnhub**, or **Trading Economics** API for the economic calendar (Schwab doesn't provide this) | Needed for CPI/FOMC/NFP/opex/triple-witching entries |

---

## 3. High-Level Architecture

```
┌─────────────────┐        ┌──────────────────────┐
│   Next.js App    │◄──────►│   PostgreSQL (Supabase)│
│  (UI + API routes)│        │  trades, legs, tags,   │
└────────┬─────────┘        │  journal, events, etc. │
         │                  └──────────────────────┘
         │
         ├── Manual "Refresh" button triggers:
         │     1. Schwab Transactions API (since last cursor)
         │     2. Group legs → logical trades (upsert)
         │     3. Schwab Price History API → entry/exit snapshots
         │     4. VIX/VIXY snapshot at entry/exit
         │     5. Update sync_log cursor
         │
         ├── Screenshot upload → Object storage (Supabase Storage)
         │     DB stores only the reference URL
         │
         └── Scheduled or manual pull → Econ calendar API
               → econ_events table
```

---

## 4. Database Schema

All tables use `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` unless noted. Timestamps are `TIMESTAMPTZ`.

### 4.1 `accounts`
Tracks linked Schwab account(s), in case you ever trade from more than one.

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schwab_account_hash TEXT NOT NULL UNIQUE,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 `account_snapshots`
Daily/periodic account value, used to build an accurate equity curve independent of trade-level P&L rounding.

```sql
CREATE TABLE account_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  snapshot_at TIMESTAMPTZ NOT NULL,
  net_liq NUMERIC(14,2),
  cash_balance NUMERIC(14,2),
  buying_power NUMERIC(14,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.3 `trades` (core table — one row per logical position, e.g. one credit spread = one row)

```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),

  -- Auto-populated from Schwab
  underlying TEXT NOT NULL,                 -- e.g. 'SPY', 'SPX', '/ES'
  instrument_type TEXT NOT NULL,            -- 'equity' | 'single_option' | 'vertical_spread' | 'other'
  strategy_label TEXT,                      -- 'CCS' (call credit spread) | 'PCS' (put credit spread) — derived from legs
  dte SMALLINT,                             -- days to expiration at entry; expect 0 for 0DTE, kept as a field in case you ever test other expirations
  entry_datetime TIMESTAMPTZ NOT NULL,
  exit_datetime TIMESTAMPTZ,
  entry_price NUMERIC(10,4),                -- credit/debit per contract
  exit_price NUMERIC(10,4),
  quantity INTEGER NOT NULL,
  realized_pnl NUMERIC(12,2),
  fees NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',      -- 'open' | 'closed'
  schwab_order_ids JSONB,                   -- array of order/transaction IDs that make up this trade

  -- Position sizing / risk
  position_size_pct NUMERIC(5,2),           -- % of account risked, manual or computed
  max_risk NUMERIC(12,2),                   -- width * contracts * 100 - credit, for spreads

  -- Market context snapshots (see 4.7) referenced, but key ones denormalized for fast dashboard queries
  vix_at_entry NUMERIC(6,2),
  vix_at_exit NUMERIC(6,2),
  underlying_price_at_entry NUMERIC(10,2),
  underlying_price_at_exit NUMERIC(10,2),

  -- Manual fields
  setup_tag_id UUID REFERENCES tags(id),
  mistake_tag_id UUID REFERENCES tags(id),
  confidence_level SMALLINT,                -- 1-5
  htf_bias TEXT,                            -- 'bullish' | 'bearish' | 'neutral'
  levels_used TEXT,                         -- free text, e.g. "resistance 775, support 770"
  reasoning TEXT,                           -- free text, why the trade was taken
  planned_exit TEXT,                        -- price/condition planned before entry
  realized_vs_planned TEXT,                 -- 'per_plan' | 'early' | 'late' | 'stopped_out' | 'other'
  emotional_state TEXT,                     -- 'calm' | 'anxious' | 'fomo' | 'tilted' | 'confident' | other free text
  high_impact_news_day BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trades_entry_datetime ON trades(entry_datetime);
CREATE INDEX idx_trades_underlying ON trades(underlying);
CREATE INDEX idx_trades_setup_tag ON trades(setup_tag_id);
```

### 4.4 `trade_legs`
Individual option legs belonging to a trade (so a credit spread's 2 legs both point back to one `trades` row).

```sql
CREATE TABLE trade_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  option_symbol TEXT NOT NULL,              -- OCC symbol
  right TEXT NOT NULL,                      -- 'call' | 'put'
  strike NUMERIC(10,2) NOT NULL,
  expiration DATE NOT NULL,
  action TEXT NOT NULL,                     -- 'sell_to_open' | 'buy_to_open' | 'buy_to_close' | 'sell_to_close'
  quantity INTEGER NOT NULL,
  price NUMERIC(10,4),
  greeks_at_entry JSONB,                    -- { delta, theta, vega, gamma, iv }
  greeks_at_exit JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_legs_trade_id ON trade_legs(trade_id);
```

### 4.5 `tags`
Shared controlled taxonomy for setup type and mistake type — kept editable rather than hardcoded, and designed to later merge with the separate Notion replay-journal taxonomy if desired.

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,                   -- 'setup' | 'mistake'
  color TEXT,                               -- hex, for UI badges
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, category)
);
```

*(If you want multiple setup tags per trade rather than one, add a join table `trade_tags(trade_id, tag_id)` instead of the FK columns on `trades`. Recommended to start with the simpler single-FK version and upgrade only if you find yourself wanting multiple tags per trade.)*

### 4.6 `screenshots`
Polymorphic-ish table — can attach to a trade or to a daily journal entry.

```sql
CREATE TABLE screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  journal_entry_id UUID REFERENCES daily_journal(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,                  -- object storage path
  caption TEXT,
  screenshot_type TEXT,                     -- 'entry' | 'exit' | 'management' | 'reference'
  taken_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (trade_id IS NOT NULL OR journal_entry_id IS NOT NULL)
);

CREATE INDEX idx_screenshots_trade_id ON screenshots(trade_id);
```

### 4.7 `market_snapshots`
Stores the underlying/VIX OHLC context around a trade's entry/exit, pulled once at sync time so it never needs to be reconstructed later.

```sql
CREATE TABLE market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL,              -- 'entry' | 'exit'
  captured_at TIMESTAMPTZ NOT NULL,
  underlying_ohlc JSONB,                    -- { open, high, low, close, volume } for the bar at that time
  vix_value NUMERIC(6,2),
  rsi_value NUMERIC(6,2),
  raw_bars JSONB,                           -- optional: array of surrounding bars for later chart reconstruction
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.8 `daily_journal`
Free-form daily/weekly reflection, independent of individual trades.

```sql
CREATE TABLE daily_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL UNIQUE,
  entry_type TEXT DEFAULT 'daily',          -- 'daily' | 'weekly' | 'monthly'
  market_bias_note TEXT,
  general_notes TEXT,
  mood TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.9 `econ_events`
Macro and options-specific calendar.

```sql
CREATE TABLE econ_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,                 -- 'CPI', 'FOMC Rate Decision', 'Monthly Opex', 'Triple Witching', etc.
  event_datetime TIMESTAMPTZ NOT NULL,
  category TEXT NOT NULL,                   -- 'macro' | 'fed' | 'options_expiry' | 'earnings' | 'other'
  impact_level TEXT,                        -- 'high' | 'medium' | 'low'
  actual_value TEXT,
  forecast_value TEXT,
  previous_value TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_econ_events_datetime ON econ_events(event_datetime);
```

### 4.10 `sync_log`
Tracks sync runs and cursors for incremental sync.

```sql
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,                  -- 'positions' | 'account_snapshot' | 'econ_calendar'
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT,                              -- 'success' | 'partial' | 'failed'
  records_added INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  cursor_value TEXT                         -- last transaction ID or ISO timestamp synced through
);
```

### 4.11 `settings`
Simple key-value store for app-level config (encrypted API tokens, preferences).

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Sync Logic (End-of-Day Manual Refresh)

Triggered by a "Refresh" button in the UI. Pseudocode:

```
function refresh():
  cursor = get_setting('last_synced_at')

  # 1. Pull new/updated transactions since cursor
  transactions = schwab.get_transactions(since=cursor)

  # 2. Group option legs into logical trades
  #    Match by: underlying + expiration + open/close timestamp proximity + strategy shape
  grouped_trades = group_legs_into_trades(transactions)

  # 3. Upsert into `trades` and `trade_legs`
  for trade in grouped_trades:
    upsert trades where schwab_order_ids overlaps trade.order_ids
    upsert trade_legs for each leg

  # 4. For each new/updated trade, fetch market context once
  for trade in new_or_updated_trades:
    entry_bar = schwab.get_price_history(trade.underlying, around=trade.entry_datetime)
    exit_bar  = schwab.get_price_history(trade.underlying, around=trade.exit_datetime) if closed
    vix_entry = schwab.get_price_history('VIX' or 'VIXY', around=trade.entry_datetime)
    vix_exit  = schwab.get_price_history('VIX' or 'VIXY', around=trade.exit_datetime) if closed
    insert into market_snapshots
    update trades.vix_at_entry / underlying_price_at_entry (denormalized copy for fast queries)

  # 5. Pull today's account snapshot
  snapshot = schwab.get_account_balance()
  insert into account_snapshots

  # 6. Update cursor
  set_setting('last_synced_at', now())
  insert into sync_log (status='success', records_added=..., records_updated=...)
```

**Key design notes:**
- Leg-grouping (step 2) is the trickiest part — match legs opened/closed within the same short window on the same underlying/expiration into one `trades` row rather than showing them as separate rows.
- New trades get all manual fields left `NULL` — the UI should visually flag "needs journaling" (e.g. a badge) until you fill them in.
- Market snapshots are captured **once**, at sync time, and never re-fetched — since Schwab's intraday history windows are limited (~48 days at 1-min, ~9 months at 5–30 min), capturing at sync time (which per your EOD cadence is same-day) avoids ever losing that context.

---

## 6. Application Structure / Pages

### 6.1 Dashboard (`/`)
- **Top stat cards:** Net P&L (toggle: day/week/month/all), win rate, avg winner vs avg loser, current streak, open positions + open risk
- **Equity curve:** cumulative P&L line chart (Recharts)
- **Daily P&L bar chart:** green/red bars per day
- **Calendar heatmap:** GitHub-style, colored by daily P&L
- **Breakdown charts:** P&L by setup tag, by day-of-week, by time-of-day entered, by instrument
- **Risk/behavior widgets:** rolling max drawdown, avg hold time, P&L distribution histogram
- **Upcoming events panel:** next 3-5 econ_events, color-coded by impact
- **Open positions panel:** live-ish list pulled from last sync

### 6.2 Positions / Trades (`/trades`)
- Full sortable/filterable table: date, underlying, strategy, entry/exit, P&L, setup tag, mistake tag, status
- Filters: date range, instrument, setup tag, mistake tag, win/loss, status
- "Needs journaling" filter (manual fields still empty)
- Bulk-tag action for quick cleanup

### 6.3 Trade Detail (`/trades/[id]`)
- Auto-populated fields (read-only, sourced from Schwab)
- Editable manual fields (all from §4.3)
- Screenshot gallery + upload/paste
- Market snapshot chart (mini OHLC around entry/exit, from `market_snapshots.raw_bars`)
- Related econ events for that day (auto-joined by date)

### 6.4 Calendar (`/calendar`)
- Month view of `econ_events`, color-coded by impact/category
- Options-specific overlay: opex, triple witching, VIX expiration dates
- Click a day → see any trades logged that day inline

### 6.5 Journal (`/journal`)
- Daily/weekly entries (free text), searchable/tag-filterable
- Auto-pulled stats for the period shown alongside the entry (P&L, win rate, top mistake tag) for context while writing

### 6.6 Settings (`/settings`)
- Schwab connection status / re-auth
- Tag management (add/edit/archive setup & mistake tags)
- Manual "Refresh" trigger + last sync timestamp + sync_log history

---

## 7. Security Considerations
- Schwab OAuth tokens stored encrypted in `settings` (or a dedicated `credentials` table), never in plain text or client-side
- Single-user auth gate in front of the whole app (simple password or NextAuth) since this holds real account/position data
- Object storage bucket for screenshots set to private, served via signed URLs, not public

---

## 8. Open Questions / Future Enhancements
- Merge this schema's `tags` taxonomy with the separate Notion replay journal so live and practice mistake patterns can be compared
- Add a "would replay agree" cross-reference field once that merge happens
- Consider a lightweight browser extension or hotkey for faster screenshot capture straight from ThinkorSwim
- Evaluate whether VIX needs a dedicated proxy symbol (VIXY) if raw VIX index bars prove awkward via Schwab's API