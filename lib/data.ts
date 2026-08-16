// ---------------------------------------------------------------------------
// Static demo dataset for the Trading Journal (UI demo only — no backend / DB).
// "Today" is mocked as Fri 2026-08-14 ET so every date on every page lines up.
// All trades are 0DTE credit spreads: opened + closed within the same session.
// ---------------------------------------------------------------------------

export const TODAY = "2026-08-14"; // Friday (ET)

// ---------------------------------------------------------------------------
// Tags (design doc §4.5) — controlled taxonomy
// ---------------------------------------------------------------------------
export interface TagDef {
  name: string;
  category: "setup" | "mistake";
  color: string;
}

export const TAGS: TagDef[] = [
  // setups
  { name: "Key Level Rejection", category: "setup", color: "#34d399" },
  { name: "Trend Pullback", category: "setup", color: "#38bdf8" },
  { name: "Momentum Breakout", category: "setup", color: "#a78bfa" },
  { name: "Volatility Fade", category: "setup", color: "#fbbf24" },
  // mistakes
  { name: "Entered on news", category: "mistake", color: "#f43f5e" },
  { name: "Oversized position", category: "mistake", color: "#fb923c" },
  { name: "Managed too late", category: "mistake", color: "#f87171" },
];

export function tagColor(name: string | null): string | undefined {
  return TAGS.find((t) => t.name === name)?.color;
}

// ---------------------------------------------------------------------------
// Trades (design doc §4.3 + §4.4 legs)
// ---------------------------------------------------------------------------
export interface Leg {
  optionSymbol: string;
  right: "call" | "put";
  strike: number;
  expiration: string; // YYYY-MM-DD
  action: "sell_to_open" | "buy_to_open";
  quantity: number;
  price: number;
  greeks: { delta: number; theta: number; vega: number; gamma: number; iv: number };
}

export interface MarketBar {
  t: string; // "HH:MM"
  close: number;
  marker?: "entry" | "exit";
}

export interface Trade {
  id: string;
  underlying: string; // 'SPY' | 'SPX'
  instrumentType: "vertical_spread";
  strategyLabel: "CCS" | "PCS";
  dte: number;
  entry: string; // "YYYY-MM-DD HH:MM"
  exit: string | null;
  entryPrice: number; // net credit per contract
  exitPrice: number | null;
  quantity: number;
  realizedPnl: number | null;
  fees: number;
  status: "open" | "closed";
  width: number;
  maxRisk: number;
  positionSizePct: number;
  vixAtEntry: number;
  vixAtExit: number | null;
  priceAtEntry: number;
  priceAtExit: number | null;
  // manual fields
  setupTag: string | null;
  mistakeTag: string | null;
  confidence: number | null; // 1-5
  htfBias: "bullish" | "bearish" | "neutral" | null;
  levelsUsed: string | null;
  reasoning: string | null;
  plannedExit: string | null;
  realizedVsPlanned: "per_plan" | "early" | "late" | "stopped_out" | "other" | null;
  emotionalState: string | null;
  highImpactNewsDay: boolean;
  legs: Leg[];
  bars: MarketBar[];
}

// deterministic wiggle so SSR and CSR render identical bars (no Math.random)
function bars(base: number, entryAt: number, exitAt: number, drift = 0): MarketBar[] {
  const out: MarketBar[] = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const wiggle = Math.sin(i * 0.9) * base * 0.0016;
    const close = base + wiggle + (drift * i) / N;
    const marker: MarketBar["marker"] =
      i === entryAt ? "entry" : i === exitAt ? "exit" : undefined;
    out.push({
      t: `${String(9 + Math.floor(i / 2)).padStart(2, "0")}:${String((i % 2) * 30).padStart(2, "0")}`,
      close: Number(close.toFixed(2)),
      marker,
    });
  }
  return out;
}

export const TRADES: Trade[] = [
  {
    id: "t1",
    underlying: "SPY",
    instrumentType: "vertical_spread",
    strategyLabel: "CCS",
    dte: 0,
    entry: "2026-08-13 14:32",
    exit: "2026-08-13 19:45",
    entryPrice: 0.42,
    exitPrice: 0.05,
    quantity: 25,
    realizedPnl: 925,
    fees: 1.25,
    status: "closed",
    width: 2.0,
    maxRisk: 3950,
    positionSizePct: 2.1,
    vixAtEntry: 14.2,
    vixAtExit: 13.1,
    priceAtEntry: 773.4,
    priceAtExit: 771.9,
    setupTag: "Key Level Rejection",
    mistakeTag: null,
    confidence: 4,
    htfBias: "bearish",
    levelsUsed: "resistance 775, support 770",
    reasoning: "Clean rejection off the 775 high on rising volume. Faded the pop into the key level.",
    plannedExit: "Take 80% at 0.08 or hold to 15:00 close if flat.",
    realizedVsPlanned: "per_plan",
    emotionalState: "calm",
    highImpactNewsDay: true,
    legs: [
      { optionSymbol: "SPY  260813C00775000", right: "call", strike: 775, expiration: "2026-08-13", action: "sell_to_open", quantity: 25, price: 0.72, greeks: { delta: -0.31, theta: 0.04, vega: 0.05, gamma: 0.02, iv: 18.4 } },
      { optionSymbol: "SPY  260813C00777000", right: "call", strike: 777, expiration: "2026-08-13", action: "buy_to_open", quantity: 25, price: 0.3, greeks: { delta: -0.19, theta: 0.03, vega: 0.05, gamma: 0.02, iv: 18.9 } },
    ],
    bars: bars(773.4, 3, 12, -1.6),
  },
  {
    id: "t2",
    underlying: "SPX",
    instrumentType: "vertical_spread",
    strategyLabel: "PCS",
    dte: 0,
    entry: "2026-08-13 10:05",
    exit: "2026-08-13 11:20",
    entryPrice: 1.1,
    exitPrice: 2.6,
    quantity: 10,
    realizedPnl: -1500,
    fees: 0.5,
    status: "closed",
    width: 3.0,
    maxRisk: 1900,
    positionSizePct: 1.5,
    vixAtEntry: 14.8,
    vixAtExit: 16.3,
    priceAtEntry: 5955.2,
    priceAtExit: 5971.8,
    setupTag: "Trend Pullback",
    mistakeTag: "Entered on news",
    confidence: 2,
    htfBias: "bullish",
    levelsUsed: "support 5940",
    reasoning: "Tried to buy the dip into 5940 support right off the open. Got run over on the CPI beat.",
    plannedExit: "Sell at 2.0 or hold to 15:00.",
    realizedVsPlanned: "stopped_out",
    emotionalState: "anxious",
    highImpactNewsDay: true,
    legs: [
      { optionSymbol: "SPX  260813P05950000", right: "put", strike: 5950, expiration: "2026-08-13", action: "sell_to_open", quantity: 10, price: 3.2, greeks: { delta: 0.42, theta: 0.03, vega: 0.06, gamma: 0.01, iv: 19.1 } },
      { optionSymbol: "SPX  260813P05920000", right: "put", strike: 5920, expiration: "2026-08-13", action: "buy_to_open", quantity: 10, price: 2.1, greeks: { delta: 0.21, theta: 0.02, vega: 0.06, gamma: 0.01, iv: 19.6 } },
    ],
    bars: bars(5955.2, 1, 7, 15),
  },
  {
    id: "t3",
    underlying: "SPY",
    instrumentType: "vertical_spread",
    strategyLabel: "CCS",
    dte: 0,
    entry: "2026-08-12 15:10",
    exit: "2026-08-12 19:55",
    entryPrice: 0.3,
    exitPrice: 0.02,
    quantity: 40,
    realizedPnl: 1120,
    fees: 2.0,
    status: "closed",
    width: 2.0,
    maxRisk: 7920,
    positionSizePct: 3.2,
    vixAtEntry: 13.9,
    vixAtExit: 12.8,
    priceAtEntry: 770.8,
    priceAtExit: 769.5,
    setupTag: "Momentum Breakout",
    mistakeTag: null,
    confidence: 5,
    htfBias: "bullish",
    levelsUsed: "breakout above 771",
    reasoning: "Strong break and hold above 771 on the afternoon. Rode the breakout with a defined-risk CCS.",
    plannedExit: "Take profit at 0.06 or roll at 15:45.",
    realizedVsPlanned: "per_plan",
    emotionalState: "confident",
    highImpactNewsDay: false,
    legs: [
      { optionSymbol: "SPY  260812C00772000", right: "call", strike: 772, expiration: "2026-08-12", action: "sell_to_open", quantity: 40, price: 0.55, greeks: { delta: -0.28, theta: 0.05, vega: 0.04, gamma: 0.02, iv: 17.2 } },
      { optionSymbol: "SPY  260812C00774000", right: "call", strike: 774, expiration: "2026-08-12", action: "buy_to_open", quantity: 40, price: 0.25, greeks: { delta: -0.16, theta: 0.04, vega: 0.04, gamma: 0.02, iv: 17.8 } },
    ],
    bars: bars(770.8, 4, 13, -1.3),
  },
  {
    id: "t4",
    underlying: "SPX",
    instrumentType: "vertical_spread",
    strategyLabel: "PCS",
    dte: 0,
    entry: "2026-08-11 13:40",
    exit: "2026-08-11 18:30",
    entryPrice: 0.85,
    exitPrice: 0.2,
    quantity: 15,
    realizedPnl: 975,
    fees: 0.75,
    status: "closed",
    width: 3.0,
    maxRisk: 4275,
    positionSizePct: 1.8,
    vixAtEntry: 15.1,
    vixAtExit: 14.0,
    priceAtEntry: 5948.6,
    priceAtExit: 5939.1,
    setupTag: "Volatility Fade",
    mistakeTag: null,
    confidence: 4,
    htfBias: "neutral",
    levelsUsed: "range 5935-5955",
    reasoning: "VIX stretched after a red morning. Faded the fear with a short-dated PCS below the range.",
    plannedExit: "Take 75% at 0.25.",
    realizedVsPlanned: "per_plan",
    emotionalState: "calm",
    highImpactNewsDay: false,
    legs: [
      { optionSymbol: "SPX  260811P05940000", right: "put", strike: 5940, expiration: "2026-08-11", action: "sell_to_open", quantity: 15, price: 1.4, greeks: { delta: 0.35, theta: 0.03, vega: 0.05, gamma: 0.01, iv: 20.3 } },
      { optionSymbol: "SPX  260811P05910000", right: "put", strike: 5910, expiration: "2026-08-11", action: "buy_to_open", quantity: 15, price: 0.55, greeks: { delta: 0.14, theta: 0.02, vega: 0.05, gamma: 0.01, iv: 20.9 } },
    ],
    bars: bars(5948.6, 3, 12, -9),
  },
  {
    id: "t5",
    underlying: "SPY",
    instrumentType: "vertical_spread",
    strategyLabel: "CCS",
    dte: 0,
    entry: "2026-08-14 14:02",
    exit: null,
    entryPrice: 0.55,
    exitPrice: null,
    quantity: 20,
    realizedPnl: null,
    fees: 1.0,
    status: "open",
    width: 2.0,
    maxRisk: 2900,
    positionSizePct: 2.3,
    vixAtEntry: 13.4,
    vixAtExit: null,
    priceAtEntry: 776.2,
    priceAtExit: null,
    setupTag: null,
    mistakeTag: null,
    confidence: null,
    htfBias: null,
    levelsUsed: null,
    reasoning: null,
    plannedExit: null,
    realizedVsPlanned: null,
    emotionalState: null,
    highImpactNewsDay: true,
    legs: [
      { optionSymbol: "SPY  260814C00780000", right: "call", strike: 780, expiration: "2026-08-14", action: "sell_to_open", quantity: 20, price: 0.95, greeks: { delta: -0.34, theta: 0.05, vega: 0.05, gamma: 0.03, iv: 16.8 } },
      { optionSymbol: "SPY  260814C00782000", right: "call", strike: 782, expiration: "2026-08-14", action: "buy_to_open", quantity: 20, price: 0.4, greeks: { delta: -0.2, theta: 0.04, vega: 0.05, gamma: 0.03, iv: 17.3 } },
    ],
    bars: bars(776.2, 10, 13, 0.6),
  },
];

export const NEEDS_JOURNALING = (t: Trade) =>
  t.setupTag == null || t.reasoning == null || t.confidence == null;

export function tradeById(id: string): Trade | undefined {
  return TRADES.find((t) => t.id === id);
}

// ---------------------------------------------------------------------------
// Econ events (design doc §4.9)
// ---------------------------------------------------------------------------
export interface EconEvent {
  id: string;
  name: string;
  datetime: string; // "YYYY-MM-DD HH:MM"
  category: "macro" | "fed" | "options_expiry" | "earnings" | "other";
  impact: "high" | "medium" | "low";
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

export const ECON_EVENTS: EconEvent[] = [
  { id: "e1", name: "CPI (m/m)", datetime: "2026-08-14 08:30", category: "macro", impact: "high", actual: "0.2%", forecast: "0.3%", previous: "0.3%" },
  { id: "e2", name: "VIX Weekly Expiration", datetime: "2026-08-19 08:30", category: "options_expiry", impact: "low", actual: null, forecast: null, previous: null },
  { id: "e3", name: "FOMC Rate Decision", datetime: "2026-08-19 18:00", category: "fed", impact: "high", actual: null, forecast: "4.25%", previous: "4.25%" },
  { id: "e4", name: "Monthly Opex", datetime: "2026-08-21 09:30", category: "options_expiry", impact: "medium", actual: null, forecast: null, previous: null },
  { id: "e5", name: "Triple Witching", datetime: "2026-08-21 09:30", category: "options_expiry", impact: "high", actual: null, forecast: null, previous: null },
];

export const IMPACT_COLOR: Record<EconEvent["impact"], string> = {
  high: "#f43f5e",
  medium: "#fbbf24",
  low: "#38bdf8",
};

// ---------------------------------------------------------------------------
// Daily journal (design doc §4.8)
// ---------------------------------------------------------------------------
export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: "daily" | "weekly" | "monthly";
  marketBias: string | null;
  notes: string;
  mood: string | null;
  stats: { pnl: number; winRate: number | null; topMistake: string | null };
}

export const JOURNAL: JournalEntry[] = [
  {
    id: "j1", date: "2026-08-13", type: "daily", mood: "calm",
    marketBias: "Bearish into CPI, light size",
    notes: "Two trades today. The afternoon CCS was a clean A+ fade off 775. The morning PCS was a reach — I shouldn't have been in front of CPI. Took the stop, no harm, but noted it.",
    stats: { pnl: -575, winRate: 0.5, topMistake: "Entered on news" },
  },
  {
    id: "j2", date: "2026-08-12", type: "daily", mood: "confident",
    marketBias: "Bullish, momentum day",
    notes: "Rode the 771 breakout nicely. Biggest size of the week and it paid off. Keep this exact setup on the list.",
    stats: { pnl: 1120, winRate: 1.0, topMistake: null },
  },
  {
    id: "j3", date: "2026-08-10", type: "weekly", mood: null,
    marketBias: "Neutral / rangebound",
    notes: "Week was quiet. Focused on process over P&L. The vol fade on Tuesday was the model trade — patience paid. Next week: no trading the first 15 min of CPI days.",
    stats: { pnl: 975, winRate: 1.0, topMistake: null },
  },
];

// ---------------------------------------------------------------------------
// Sync log (design doc §4.10) + Schwab connection (for /settings)
// ---------------------------------------------------------------------------
export interface SyncLogRow {
  id: string;
  type: "positions" | "account_snapshot" | "econ_calendar";
  startedAt: string;
  status: "success" | "partial" | "failed";
  added: number;
  updated: number;
  error: string | null;
}

export const SYNC_LOG: SyncLogRow[] = [
  { id: "s1", type: "positions", startedAt: "2026-08-14 21:05", status: "success", added: 1, updated: 0, error: null },
  { id: "s2", type: "account_snapshot", startedAt: "2026-08-14 21:05", status: "success", added: 1, updated: 0, error: null },
  { id: "s3", type: "econ_calendar", startedAt: "2026-08-14 21:05", status: "success", added: 2, updated: 1, error: null },
  { id: "s4", type: "positions", startedAt: "2026-08-13 21:10", status: "success", added: 2, updated: 0, error: null },
  { id: "s5", type: "econ_calendar", startedAt: "2026-08-13 21:10", status: "partial", added: 1, updated: 0, error: "1 event missing source timestamp" },
];

export const LAST_SYNC = "2026-08-14 21:05 ET";
