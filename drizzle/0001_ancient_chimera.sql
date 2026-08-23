CREATE TABLE "account_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"snapshot_at" timestamp with time zone NOT NULL,
	"net_liq" numeric(14, 2),
	"cash_balance" numeric(14, 2),
	"buying_power" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schwab_account_hash" text NOT NULL,
	"nickname" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_schwab_account_hash_unique" UNIQUE("schwab_account_hash")
);
--> statement-breakpoint
CREATE TABLE "daily_journal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_date" date NOT NULL,
	"entry_type" text DEFAULT 'daily',
	"market_bias_note" text,
	"general_notes" text,
	"mood" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_journal_entry_date_unique" UNIQUE("entry_date")
);
--> statement-breakpoint
CREATE TABLE "econ_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"event_datetime" timestamp with time zone NOT NULL,
	"category" text NOT NULL,
	"impact_level" text,
	"actual_value" text,
	"forecast_value" text,
	"previous_value" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid,
	"snapshot_type" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"underlying_ohlc" jsonb,
	"vix_value" numeric(6, 2),
	"rsi_value" numeric(6, 2),
	"raw_bars" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid,
	"journal_entry_id" uuid,
	"image_url" text NOT NULL,
	"caption" text,
	"screenshot_type" text,
	"taken_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "screenshots_trade_or_journal_check" CHECK ("screenshots"."trade_id" IS NOT NULL OR "screenshots"."journal_entry_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_type" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text,
	"records_added" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"error_message" text,
	"cursor_value" text
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_category_unique" UNIQUE("name","category")
);
--> statement-breakpoint
CREATE TABLE "trade_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid,
	"option_symbol" text NOT NULL,
	"right" text NOT NULL,
	"strike" numeric(10, 2) NOT NULL,
	"expiration" date NOT NULL,
	"action" text NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric(10, 4),
	"greeks_at_entry" jsonb,
	"greeks_at_exit" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"underlying" text NOT NULL,
	"instrument_type" text NOT NULL,
	"strategy_label" text,
	"dte" smallint,
	"entry_datetime" timestamp with time zone NOT NULL,
	"exit_datetime" timestamp with time zone,
	"entry_price" numeric(10, 4),
	"exit_price" numeric(10, 4),
	"quantity" integer NOT NULL,
	"realized_pnl" numeric(12, 2),
	"fees" numeric(10, 2) DEFAULT '0',
	"status" text DEFAULT 'open' NOT NULL,
	"schwab_order_ids" jsonb,
	"position_size_pct" numeric(5, 2),
	"max_risk" numeric(12, 2),
	"vix_at_entry" numeric(6, 2),
	"vix_at_exit" numeric(6, 2),
	"underlying_price_at_entry" numeric(10, 2),
	"underlying_price_at_exit" numeric(10, 2),
	"setup_tag_id" uuid,
	"mistake_tag_id" uuid,
	"confidence_level" smallint,
	"htf_bias" text,
	"levels_used" text,
	"reasoning" text,
	"planned_exit" text,
	"realized_vs_planned" text,
	"emotional_state" text,
	"high_impact_news_day" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_journal_entry_id_daily_journal_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."daily_journal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_legs" ADD CONSTRAINT "trade_legs_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_setup_tag_id_tags_id_fk" FOREIGN KEY ("setup_tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_mistake_tag_id_tags_id_fk" FOREIGN KEY ("mistake_tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_econ_events_datetime" ON "econ_events" USING btree ("event_datetime");--> statement-breakpoint
CREATE INDEX "idx_screenshots_trade_id" ON "screenshots" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "idx_legs_trade_id" ON "trade_legs" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "idx_trades_entry_datetime" ON "trades" USING btree ("entry_datetime");--> statement-breakpoint
CREATE INDEX "idx_trades_underlying" ON "trades" USING btree ("underlying");--> statement-breakpoint
CREATE INDEX "idx_trades_setup_tag" ON "trades" USING btree ("setup_tag_id");