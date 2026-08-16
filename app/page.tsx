"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Panel,
  StatCard,
  StatusBadge,
  NeedsJournalingBadge,
  PnlValue,
  ImpactDot,
  Segmented,
  Button,
} from "@/components/ui";
import {
  netPnl,
  winRate,
  avgWinner,
  avgLoser,
  currentStreak,
  openPositions,
  openRisk,
  dailyPnl,
  equityCurve,
  maxDrawdown,
  avgHoldMinutes,
  pnlBySetup,
  pnlByInstrument,
  pnlByWeekday,
  pnlByTimeOfDay,
  pnlHistogram,
} from "@/lib/stats";
import { ECON_EVENTS, IMPACT_COLOR } from "@/lib/data";
import { usd, signedUsd, pct, day } from "@/lib/format";

const GOOD = "#34d399";
const BAD = "#f43f5e";
const GRID = "#27272a";
const AXIS = "#71717a";

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: 8,
  fontSize: 12,
  color: "#e4e4e7",
};

// ---------------------------------------------------------------------------
// GitHub-style calendar heatmap for the current month (Aug 2026)
// ---------------------------------------------------------------------------
function Heatmap() {
  const byDate = new Map(dailyPnl().map((d) => [d.date, d.pnl]));
  const year = 2026,
    month = 7; // August (0-indexed)
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
  ];

  const color = (v: number | undefined) => {
    if (v == null) return "bg-zinc-800/50";
    if (v <= -1000) return "bg-rose-500";
    if (v < 0) return "bg-rose-500/60";
    if (v === 0) return "bg-zinc-700";
    if (v < 500) return "bg-emerald-500/40";
    if (v < 1000) return "bg-emerald-500/70";
    return "bg-emerald-500";
  };

  return (
    <div>
      <div className="mb-2 flex gap-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] font-medium text-zinc-600">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          c ? (
            <div
              key={i}
              title={`${c}: ${byDate.has(c) ? signedUsd(byDate.get(c)!) : "no trades"}`}
              className={`flex h-7 items-center justify-center rounded text-[10px] font-medium text-zinc-200/80 ${color(byDate.get(c))}`}
            >
              {Number(c.slice(-2))}
            </div>
          ) : (
            <div key={i} className="h-7" />
          )
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
        <span>Loss</span>
        <span className="h-2.5 w-2.5 rounded bg-rose-500/60" />
        <span className="h-2.5 w-2.5 rounded bg-rose-500" />
        <span className="ml-2">Profit</span>
        <span className="h-2.5 w-2.5 rounded bg-emerald-500/40" />
        <span className="h-2.5 w-2.5 rounded bg-emerald-500/70" />
        <span className="h-2.5 w-2.5 rounded bg-emerald-500" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny horizontal bar list for breakdowns
// ---------------------------------------------------------------------------
function HBarList({ data }: { data: { name: string; pnl: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.pnl)));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.name}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-zinc-400">{d.name}</span>
            <PnlValue value={d.pnl} />
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-zinc-800">
            <div
              className={`h-full rounded ${d.pnl >= 0 ? "bg-emerald-400" : "bg-rose-400"}`}
              style={{ width: `${(Math.abs(d.pnl) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState<"day" | "week" | "month" | "all">("all");
  const open = openPositions();
  const hist = pnlHistogram();
  const histMax = Math.max(1, ...hist.map((x) => x.count));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Dashboard</h1>
          <p className="text-xs text-zinc-500">Performance overview · last synced 2026-08-14 21:05 ET</p>
        </div>
        <Button>Export report</Button>
      </div>

      {/* ---- top stat cards ---- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Net P&L"
          value={<PnlValue value={netPnl(range)} />}
          sub={`${range === "all" ? "all time" : `last ${range}`} · realized`}
        >
          <div className="mt-3">
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Wk" },
                { value: "month", label: "Mo" },
                { value: "all", label: "All" },
              ]}
            />
          </div>
        </StatCard>
        <StatCard
          label="Win Rate"
          value={winRate() == null ? "—" : pct(winRate()!)}
          sub="3W / 1L · closed trades"
          tone={winRate() != null && winRate()! >= 0.5 ? "good" : "bad"}
        />
        <StatCard
          label="Avg Winner / Loser"
          value={
            <span className="flex items-baseline gap-2">
              <span className="text-emerald-400">{avgWinner() != null ? usd(avgWinner()!) : "—"}</span>
              <span className="text-sm text-zinc-600">/</span>
              <span className="text-rose-400">{avgLoser() != null ? usd(avgLoser()!) : "—"}</span>
            </span>
          }
          sub="per-trade average"
        />
        <StatCard
          label="Current Streak"
          value={currentStreak()}
          sub="most recent closed first"
          tone="neutral"
        />
        <StatCard
          label="Open Positions"
          value={
            <span className="flex items-baseline gap-2">
              <span>{open.length}</span>
              <span className="text-sm text-zinc-500">open risk {usd(openRisk())}</span>
            </span>
          }
          sub="from last sync"
        />
      </div>

      {/* ---- equity curve + upcoming events ---- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Equity Curve" subtitle="Cumulative realized P&L" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurve()} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOOD} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={GOOD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: AXIS, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                  width={56}
                />
                <Tooltip
                  cursor={{ stroke: "#3f3f46" }}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#a1a1aa", fontSize: 12 }}
                  itemStyle={{ color: "#e4e4e7", fontSize: 12 }}
                  formatter={(v: number) => [usd(v), "Equity"]}
                />
                <Area type="monotone" dataKey="equity" stroke={GOOD} strokeWidth={2} fill="url(#eq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Upcoming Events" subtitle="Next 5 · by impact">
          <ul className="space-y-3">
            {ECON_EVENTS.map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <div className="mt-1">
                  <ImpactDot impact={e.impact} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">{e.name}</p>
                  <p className="text-xs text-zinc-500">
                    {day(e.datetime)} · {e.datetime.split(" ")[1]} · {e.category}
                  </p>
                </div>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ color: IMPACT_COLOR[e.impact], backgroundColor: `${IMPACT_COLOR[e.impact]}1a` }}
                >
                  {e.impact}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* ---- daily P&L + heatmap ---- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Daily P&L" subtitle="Realized P&L per day">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyPnl()} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(d) => day(d)} />
                <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={56} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.05)", stroke: "none" }}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#a1a1aa", fontSize: 12 }}
                  itemStyle={{ color: "#e4e4e7", fontSize: 12 }}
                  formatter={(v: number) => [signedUsd(v), "P&L"]}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {dailyPnl().map((d) => (
                    <Cell key={d.date} fill={d.pnl >= 0 ? GOOD : BAD} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Calendar Heatmap" subtitle="August 2026 · daily P&L">
          <Heatmap />
        </Panel>
      </div>

      {/* ---- breakdown charts ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="P&L by Setup">
          <HBarList data={pnlBySetup()} />
        </Panel>
        <Panel title="P&L by Day of Week">
          <HBarList data={pnlByWeekday()} />
        </Panel>
        <Panel title="P&L by Time Entered">
          <HBarList data={pnlByTimeOfDay()} />
        </Panel>
        <Panel title="P&L by Instrument">
          <HBarList data={pnlByInstrument()} />
        </Panel>
      </div>

      {/* ---- risk / behavior ---- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 xl:col-span-1">
          <StatCard label="Max Drawdown" value={usd(maxDrawdown())} sub="rolling, from equity curve" tone="bad" />
          <StatCard
            label="Avg Hold Time"
            value={
              avgHoldMinutes() == null
                ? "—"
                : `${Math.floor(avgHoldMinutes()! / 60)}h ${Math.round(avgHoldMinutes()! % 60)}m`
            }
            sub="entry → exit"
          />
        </div>
        <Panel title="P&L Distribution" subtitle="Histogram of closed trades · wins up, losses down" className="xl:col-span-2">
          <div className="flex items-stretch justify-around gap-4">
            {hist.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center">
                {/* top half — wins grow up from the zero line */}
                <div className="flex h-20 w-full items-end justify-center">
                  {b.tone === "win" ? (
                    <div
                      className="w-full max-w-[40px] rounded-t bg-emerald-500/70"
                      style={{ height: `${(b.count / histMax) * 100}%` }}
                      title={`${b.count} winning trade${b.count === 1 ? "" : "s"}`}
                    />
                  ) : null}
                </div>
                {/* zero line */}
                <div className="h-px w-full bg-zinc-700" />
                {/* bottom half — losses grow down from the zero line */}
                <div className="flex h-20 w-full items-start justify-center">
                  {b.tone === "loss" ? (
                    <div
                      className="w-full max-w-[40px] rounded-b bg-rose-500/70"
                      style={{ height: `${(b.count / histMax) * 100}%` }}
                      title={`${b.count} losing trade${b.count === 1 ? "" : "s"}`}
                    />
                  ) : null}
                </div>
                <span className="mt-2 text-center text-[10px] leading-tight text-zinc-500">{b.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="h-2.5 w-2.5 rounded bg-emerald-500/70" /> Win (above zero)
            <span className="ml-2 h-2.5 w-2.5 rounded bg-rose-500/70" /> Loss (below zero)
          </div>
        </Panel>
      </div>

      {/* ---- open positions ---- */}
      <Panel title="Open Positions" subtitle="From last sync — click a row for detail">
        {open.length === 0 ? (
          <p className="text-sm text-zinc-500">No open positions.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="pb-2 font-medium">Underlying</th>
                <th className="pb-2 font-medium">Strategy</th>
                <th className="pb-2 font-medium">Entry</th>
                <th className="pb-2 font-medium">Qty</th>
                <th className="pb-2 font-medium">Open Risk</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {open.map((t) => (
                <tr key={t.id} className="border-t border-zinc-800">
                  <td className="py-2 font-medium text-zinc-200">{t.underlying}</td>
                  <td className="py-2 text-zinc-400">{t.strategyLabel} · {t.dte}DTE</td>
                  <td className="py-2 text-zinc-400">{day(t.entry)}</td>
                  <td className="py-2 tabular-nums text-zinc-400">{t.quantity}</td>
                  <td className="py-2 tabular-nums text-zinc-200">{usd(t.maxRisk)}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      {t.setupTag == null && <NeedsJournalingBadge />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
