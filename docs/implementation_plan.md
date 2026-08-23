# Trading Journal — Feature Gap Analysis & Implementation Plan

**Status:** Analysis only — no code has been changed.
**Basis:** `docs/design_doc.md` (target design) vs. current codebase.

---

## Current State (what already works)

- **Frontend UI (static demo, all pages functional):** Dashboard, Trades list, Trade detail, Calendar, Journal, Settings.
- **Plotting/styling:** Recharts + shadcn/ui-inspired dark components (`components/ui.tsx`, `MarketSnapshotChart.tsx`).
- **Demo data layer:** `lib/data.ts` (mock trades/legs/bars, tags, econ events, journal, sync log), `lib/stats.ts` (pure aggregations), `lib/format.ts`.
- **Auth:** single-user password gate — login route, scrypt hashing, HMAC-signed 7-day session cookie, middleware redirect. (Functional, but see hardening items below.)
- **Schwab integration (complete in isolation):** OAuth flow + token refresh (`lib/schwab/oauth.ts`), API client with bearer/retry (`client.ts`), encrypted token store backed by the DB `settings` table (AES-256-GCM), standalone host auth script (`scripts/schwab-auth.ts`), connection status/test actions.
- **DB scaffolding:** Drizzle + Postgres wired up; only the generic `settings` KV table is defined/migrated. Docker Compose (`postgres` + `web`) and `web.Dockerfile` exist.

**Bottom line:** Everything beyond the `settings` table is still hardcoded demo data. The large remaining body of work is making the app read/write real, persisted data through the sync pipeline, plus a set of UI actions that are currently visual-only.

---

## Feature Gaps (grouped by theme)

### A. Database schema build-out (foundation for everything else)
Design doc §4 defines 11 tables; only `settings` exists. Need Drizzle schema, migrations, and indexes for:
1. `accounts` + `account_snapshots` (equity curve from real data).
2. `trades` (core — auto + manual fields, status, risk, VIX/price context).
3. `trade_legs` (option legs → one logical trade), FK to trades.
4. `tags` (+ the `UNIQUE(name, category)` constraint). Decide later on the `trade_tags` join table if multiple tags per trade are needed.
5. `screenshots` (trade or journal FK with CHECK constraint).
6. `market_snapshots` (entry/exit OHLC + VIX + raw bars captured once at sync).
7. `daily_journal` (unique per date; daily/weekly/monthly).
8. `econ_events` (macro/fed/options expiry/earnings).
9. `sync_log` (cursor + per-run status/counts/errors).
10. Seed endpoint/script for setup + mistake tags so the UI taxonomy has data.

### B. End-of-day sync pipeline (design doc §5) — the core missing feature
Current "Refresh" is a visual-only button with no handler. Need a server action / route that runs the full flow:
1. Read cursor (`last_synced_at` from settings) → pull new/updated Schwab transactions since it.
2. Group option legs into logical trades (step 2 in §5 is flagged as the trickiest — match by underlying + expiration + open/close timestamp proximity + strategy shape). This is the largest algorithmic chunk.
3. Upsert `trades` + `trade_legs`, keyed on `schwab_order_ids`.
4. For each new/updated trade, fetch market context once (underlying price history around entry/exit, VIX/VIXY, greeks) → write `market_snapshots` + denormalized columns on `trades`.
5. Pull today's account balance → `account_snapshots`.
6. Update cursor + insert `sync_log` row (status, added/updated counts, error). Handle `partial`/`failed` statuses on error.
7. Progress/status surfaced in the UI (spinner on Refresh, latest sync in sidebar/settings).

### C. Persist and wire the trade journaling (manual fields)
1. Save manual fields from the Trade Detail "Journal" panel (setup/mistake tag, confidence, HTF bias, levels, reasoning, planned exit, realized-vs-planned, emotional state, news-day flag) to `trades`. Currently a visual-only "Save" button.
2. Derive the "Needs journaling" state from actual DB `NULL`s, not the mock `NEEDS_JOURNALING` helper.
3. Trade detail auto-populated rows (from §4.3) should come from the DB (and resolved Schwab data where available).

### D. Screenshots (upload → object storage → signed URLs)
1. Choose storage backend (Supabase storage / R2 / S3).
2. Upload from Trade Detail (and Journal) — the "Upload / paste" buttons are visual-only today.
3. Store only a reference URL in `screenshots`; serve via signed, time-limited URLs (private bucket). Design doc §7.
4. Build the gallery (entry/exit/management) with captions + types.

### E. Economic calendar integration
1. Pick a data provider (FMP / Finnhub / Trading Economics) — Schwab doesn't provide this.
2. Scheduled or manual pull → `econ_events`  (CPI/FOMC/NFP/opex/triple-witching/VIX expiry).
3. Replace the hardcoded `ECON_EVENTS` with DB data across Dashboard "Upcoming Events", Calendar, and Trade Detail "Events That Day" (join by date).

### F. Replace remaining hardcoded demo data across pages
1. **Dashboard:** top stat cards (Net P&L range toggle, win rate, avg W/L, streak, open risk), equity curve, daily P&L, heatmap, breakdowns, max drawdown, hold time, histogram — all should compute from DB.
2. **Trades:** sortable/filterable table, bulk-tag action (currently visual-only), needs-journaling filter from DB.
3. **Calendar:** month P&L, day events + trades from DB.
4. **Journal:** list/create daily/weekly/monthly entries + auto-period stats. "New entry" is visual-only.
5. **Settings:** tag management (add/edit/archive) persisted to `tags`; sync history from `sync_log`; `LAST_SYNC` real.
6. Remove/replace static `TODAY` and mock data once live.

### G. Auth hardening (secondary, "nice to have" for production)
1. Rate-limit the login route (brute-force protection).
2. Session invalidation / logout endpoint (currently no logout).
3. Consider broader catch against CSRF on the session cookie; confirm `secure`/`sameSite` settings.
4. Secret/env validation at startup with clear errors.

### H. Deployment / ops (final polish)
1. Confirm production build works end-to-end (`web.Dockerfile` already builds standalone).
2. Migrations run automatically on deploy (entrypoint step) or documented manual step.
3. Document Supabase/Vercel vs. self-hosted Postgres + storage decisions; fill real `.env.local`.
4. Vercel Cron (or manual/`docker` scheduled) for econ calendar and optional periodic snapshot.

---

## Proposed Execution Order (systematic, dependency-driven)

Each step ends in a buildable, working state. Steps 1–3 must precede everything else (they are the data foundation); later steps can be parallelized.

### Phase 0 — Baseline & groundwork (small, do first)
- **0.1** Audit `.env.example` and add missing vars as placeholders; keep pre-commit scanner happy.
  - ✅ Done (local-only, no cloud): added `SCREENSHOT_DIR` (local filesystem screenshot storage, design_doc.md §4.6) and econ-calendar placeholders (`ECON_API_PROVIDER`, `ECON_API_KEY`). `.gitignore` now excludes `/data/` for local screenshot storage.
- **0.2** Add a run-migrations script/npm entrypoint (`db:migrate` exists; add auto-migrate on boot for a single deploy step).
  - ✅ Done: added `scripts/migrate.ts` (runtime Drizzle migrator via `drizzle-orm/postgres-js/migrator`, no CLI dependency), npm `db:up` script, and `predev`/`prestart` lifecycle hooks so migrations run automatically on boot (idempotent).
- **Verification:** `docker compose up` with an existing migration set → clean boot.

### Phase 1 — Full database schema (foundation)
- **1.1** Define all §4 tables in `lib/db/schema.ts` (Drizzle), matching types: UUID PKs, TIMESTAMPTZ, NUMERIC, JSONB, FKs with `ON DELETE CASCADE`, CHECK constraints, and the listed indexes.
- **1.2** `npm run db:generate` → commit migration(s); `npm run db:migrate` against local Postgres.
- **1.3** Seed script for initial `tags` (the seven demo tags) and, if useful, a `daily_journal`/`econ_events` starter set.
- **Why first:** every feature (B–F) reads/writes this data; there is no parallel work that doesn't depend on it.
- **Verification:** migrate cleanly; seed `tags`; spot-query tables via a small script.

### Phase 2 — End-of-day sync pipeline (biggest algorithmic work, core value)
- **2.1** Cursor read/write helpers over `settings` (`last_synced_at`).
- **2.2** Schwab data-fetch additions on `SchwabClient` as needed: full transaction schema typing (legs/greeks), account balances, price-history-around-time lookup, VIX/VIXY snapshot.
- **2.3** Transaction → logical-trade grouping algorithm (underlying + expiration + timestamps + strategy shape). Build with unit tests over fixtures (this is the riskiest logic).
- **2.4** Upsert `trades` + `trade_legs` keyed on `schwab_order_ids`.
- **2.5** Market-context capture → `market_snapshots` + denormalized trade columns (VIX/price at entry/exit).
- **2.6** Account snapshot pull → `account_snapshots`.
- **2.7** `sync_log` writes (success/partial/failed with counts + cursor), then update cursor.
- **2.8** Server action + UI wiring for the Refresh button (spinner, disabled state, surfaced status).
- **Why here:** unlocks real data for every page in F; also validates the schema in Phase 1 under real writes.
- **Verification:** run Refresh against a test Schwab account → trades/legs/snapshots/log appear in DB; re-run is idempotent (no dupes).

### Phase 3 — Persist journaling + wire Trade detail
- **3.1** Server action to save the manual journal fields on `trades`.
- **3.2** Load trade detail (auto + manual) from DB; keep `notFound()` for bad id.
- **3.3** Drive `NeedsJournalingBadge` from DB `NULL`s across Trade list/detail/dashboard.
- **3.4** Make "Save" return success/error feedback.
- **Why here:** quick win that depends on Phase 1 and nothing in Phase 2's hard parts.
- **Verification:** edit+save a trade → persists; badge disappears.

### Phase 4 — Screenshots
- **4.1** Storage provider integration (private bucket, upload API).
- **4.2** Server action: upload bytes → object storage → insert `screenshots` row (trade_id or journal_entry_id, caption, type).
- **4.3** Gallery on Trade detail (+ Journal) listing images; signed URL generation for serving.
- **4.4** Upload/paste UI wired to actions with progress/error states.
- **Why here:** independent of sync; requires `screenshots` + `daily_journal` tables (Phase 1) and journal save (Phase 3) for FK integrity.
- **Verification:** upload a real image → appears in DB + gallery; URL expires properly.

### Phase 5 — Replace hardcoded demo data page-by-page (now that pipeline + persistence exist)
- **5.1** `lib/stats.ts` functions converted to query the DB (same pure aggregation shape → minimal UI change). Refactor `lib/data.ts` mock exports into DB-backed reads.
- **5.2** Dashboard (all cards/charts from DB).
- **5.3** Trades list (filters/sort from DB) + bulk-tag action → `trades`/`trade_tags`.
- **5.4** Calendar (real events + trades + month P&L).
- **5.5** Journal (list + new entry create + period stats).
- **5.6** Settings (tag CRUD → `tags`, sync history → `sync_log`, real last-sync).
- **5.7** Remove static `TODAY`/mock fallbacks; decide how "today" resolves (client time vs. server ET).
- **Why here:** depends on Phase 2 data existing + Phase 3/4 writes. Do page-by-page so the app stays runnable.
- **Verification:** each page shows DB-backed data; no page references mock exports.

### Phase 6 — Economic calendar integration
- **6.1** Provider selection + env config; data-fetch module.
- **6.2** Sync action → upsert `econ_events`.
- **6.3** Wire Calendar / Dashboard / Trade detail to DB events; add manual refresh for events.
- **Why here:** independent data source; can run in parallel with Phases 3–5. Placed here for a clean sequential story, but safely parallelizable.
- **Verification:** events pull into DB; calendar colors/OPX badges reflect real rows.

### Phase 7 — Performance/UX + correctness on real volumes
- **7.1** Pagination / virtualization for the trades table at large counts.
- **7.2** Aggregation query review (indexes on joins used by stats); add any missing indexes.
- **7.3** Loading/empty/error states for all DB-backed pages; handle slow sync gracefully.

### Phase 8 — Auth hardening + ops (productionization)
- **8.1** Login rate limiting; logout endpoint; CSRF review.
- **8.2** Auto-migrate on deploy; document/provision storage; finalize hosting choice (Supabase vs. self-hosted).
- **8.3** Scheduled sync/cron for econ calendar + optional periodic account snapshot.
- **8.4** End-to-end staging test in docker compose; verify secrets handling + pre-commit scanner.

---

## Suggested Sequencing Summary

| Order | Phase | Dependency | Est. Size |
|---|---|---|---|
| 0 | Baseline & groundwork | — | S |
| 1 | Full DB schema | 0 | M |
| 2 | Sync pipeline | 1 | **XL** (grouping logic) |
| 3 | Journal persistence + trade detail | 1 | M |
| 4 | Screenshots | 1, 3 | M |
| 5 | Replace hardcoded demo data (page-by-page) | 2, 3, 4 | L |
| 6 | Econ calendar | 1 (parallel w/ 3–5) | M |
| 7 | Performance/UX | 5 | M |
| 8 | Auth + ops | all | M |

**Recommended start:** Phase 1 (schema) → Phase 2 (sync). Everything of value depends on those two, and Phase 2 is the highest-risk piece (leg grouping), so doing it early de-risks the roadmap.
