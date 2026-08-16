// Pure, deterministic aggregations over the static demo trades (design doc §6.1).
// Safe to import from both server and client components (no side effects).

import { TRADES, type Trade } from "./data";
import { holdTime } from "./format";

type PnlRange = "day" | "week" | "month" | "all";

const TODAY = "2026-08-14"; // Fri
const DAY_MS = 86400000;
const dateOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

function inRange(iso: string, range: PnlRange): boolean {
  const d = dateOf(iso.slice(0, 10));
  const now = dateOf(TODAY);
  if (range === "all") return true;
  if (range === "day") return d === now;
  if (range === "week") return now - d < 7 * DAY_MS;
  return now - d < 31 * DAY_MS; // month
}

/** Net realized P&L for a range. */
export function netPnl(range: PnlRange): number {
  return TRADES.filter((t) => t.status === "closed" && inRange(t.entry, range))
    .reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
}

export function closedTrades(): Trade[] {
  return TRADES.filter((t) => t.status === "closed");
}

export function winRate(): number | null {
  const c = closedTrades();
  if (!c.length) return null;
  return c.filter((t) => (t.realizedPnl ?? 0) > 0).length / c.length;
}

export function avgWinner(): number | null {
  const w = closedTrades().filter((t) => (t.realizedPnl ?? 0) > 0).map((t) => t.realizedPnl!);
  return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
}

export function avgLoser(): number | null {
  const l = closedTrades().filter((t) => (t.realizedPnl ?? 0) <= 0).map((t) => t.realizedPnl!);
  return l.length ? l.reduce((a, b) => a + b, 0) / l.length : null;
}

/** Current win/loss streak, most-recent closed trade first. e.g. "2W" */
export function currentStreak(): string {
  const c = closedTrades().sort((a, b) => (b.exit ?? "").localeCompare(a.exit ?? ""));
  if (!c.length) return "—";
  const kind = (c[0].realizedPnl ?? 0) > 0 ? "W" : "L";
  let n = 0;
  for (const t of c) {
    if (((t.realizedPnl ?? 0) > 0 ? "W" : "L") === kind) n++;
    else break;
  }
  return `${n}${kind}`;
}

export function openPositions(): Trade[] {
  return TRADES.filter((t) => t.status === "open");
}

export function openRisk(): number {
  return openPositions().reduce((s, t) => s + t.maxRisk, 0);
}

/** Daily realized P&L keyed by YYYY-MM-DD, chronological. */
export function dailyPnl(): { date: string; pnl: number }[] {
  const map = new Map<string, number>();
  for (const t of closedTrades()) {
    const d = t.entry.slice(0, 10);
    map.set(d, (map.get(d) ?? 0) + (t.realizedPnl ?? 0));
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, pnl]) => ({ date, pnl }));
}

/** Cumulative realized P&L series (starts at 0). */
export function equityCurve(): { date: string; equity: number }[] {
  let run = 0;
  const out = [{ date: "start", equity: 0 }];
  for (const { date, pnl } of dailyPnl()) {
    run += pnl;
    out.push({ date, equity: run });
  }
  return out;
}

/** Max drawdown (absolute $) from the cumulative equity curve. */
export function maxDrawdown(): number {
  let peak = -Infinity;
  let dd = 0;
  for (const { equity } of equityCurve()) {
    peak = Math.max(peak, equity);
    dd = Math.min(dd, equity - peak);
  }
  return Math.abs(dd);
}

export function avgHoldMinutes(): number | null {
  const c = closedTrades();
  if (!c.length) return null;
  const toMin = (s: string) => {
    const [d, t] = s.split(" ");
    const [y, m, day] = d.split("-").map(Number);
    const [hh, mm] = t.split(":").map(Number);
    return new Date(y, m - 1, day, hh, mm).getTime() / 60000;
  };
  const mins = c.map((t) => toMin(t.exit!) - toMin(t.entry));
  return mins.reduce((a, b) => a + b, 0) / mins.length;
}

/** P&L grouped by a string key. */
function groupBy(fn: (t: Trade) => string): { name: string; pnl: number }[] {
  const map = new Map<string, number>();
  for (const t of closedTrades()) map.set(fn(t), (map.get(fn(t)) ?? 0) + (t.realizedPnl ?? 0));
  return [...map.entries()].map(([name, pnl]) => ({ name, pnl }));
}

export const pnlBySetup = () => groupBy((t) => t.setupTag ?? "—");
export const pnlByInstrument = () => groupBy((t) => t.underlying);

export function pnlByWeekday(): { name: string; pnl: number }[] {
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const map = new Map<string, number>();
  for (const t of closedTrades()) {
    const [y, m, d] = t.entry.slice(0, 10).split("-").map(Number);
    const wd = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
    map.set(wd, (map.get(wd) ?? 0) + (t.realizedPnl ?? 0));
  }
  return order.filter((w) => map.has(w)).map((w) => ({ name: w, pnl: map.get(w)! }));
}

export function pnlByTimeOfDay(): { name: string; pnl: number }[] {
  const bucket = (t: string) => {
    const h = Number(t.split(" ")[1].split(":")[0]);
    if (h < 12) return "Morning";
    if (h < 14) return "Midday";
    if (h < 16) return "Afternoon";
    return "Close";
  };
  return groupBy((t) => bucket(t.entry));
}

/** Simple P&L distribution histogram (fixed bins). tone marks loss vs win buckets. */
export function pnlHistogram(): { label: string; count: number; tone: "loss" | "win" }[] {
  const values = closedTrades().map((t) => t.realizedPnl ?? 0);
  const bins: { label: string; tone: "loss" | "win"; test: (v: number) => boolean }[] = [
    { label: "≤ -$1,500", tone: "loss", test: (v) => v <= -1500 },
    { label: "-1.5k..-500", tone: "loss", test: (v) => v > -1500 && v <= -500 },
    { label: "-500..0", tone: "loss", test: (v) => v > -500 && v <= 0 },
    { label: "0..1k", tone: "win", test: (v) => v > 0 && v <= 1000 },
    { label: "> $1,000", tone: "win", test: (v) => v > 1000 },
  ];
  return bins.map((b) => ({ label: b.label, tone: b.tone, count: values.filter(b.test).length }));
}

export { holdTime };
