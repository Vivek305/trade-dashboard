"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Panel, ImpactDot, PnlValue, StatusBadge, TagBadge, NeedsJournalingBadge } from "@/components/ui";
import { ECON_EVENTS, TRADES, IMPACT_COLOR, TODAY, NEEDS_JOURNALING, type EconEvent } from "@/lib/data";
import { signedUsd } from "@/lib/format";

const CATEGORY_LABEL: Record<EconEvent["category"], string> = {
  macro: "Macro",
  fed: "Fed",
  options_expiry: "Options",
  earnings: "Earnings",
  other: "Other",
};

// build date -> data maps
const eventsByDate = new Map<string, EconEvent[]>();
for (const e of ECON_EVENTS) {
  const k = e.datetime.slice(0, 10);
  eventsByDate.set(k, [...(eventsByDate.get(k) ?? []), e]);
}
const tradesByDate = new Map<string, typeof TRADES>();
for (const t of TRADES) {
  const k = t.entry.slice(0, 10);
  tradesByDate.set(k, [...(tradesByDate.get(k) ?? []), t]);
}

export default function CalendarPage() {
  const [selected, setSelected] = useState(TODAY);
  const year = 2026,
    month = 7; // August

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
  ];

  const dayEvents = eventsByDate.get(selected) ?? [];
  const dayTrades = tradesByDate.get(selected) ?? [];
  const monthPnl = useMemo(
    () => TRADES.filter((t) => t.entry.slice(0, 7) === "2026-08" && t.status === "closed").reduce((s, t) => s + (t.realizedPnl ?? 0), 0),
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Calendar</h1>
          <p className="text-xs text-zinc-500">Economic &amp; options events · August 2026 · month P&amp;L {signedUsd(monthPnl)}</p>
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          <ChevronLeft className="h-4 w-4 opacity-40" />
          <span className="px-2 text-sm font-medium text-zinc-200">August 2026</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <div className="mb-2 grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-zinc-600">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c) return <div key={i} className="min-h-[84px] rounded-lg" />;
              const evs = eventsByDate.get(c) ?? [];
              const trs = tradesByDate.get(c) ?? [];
              const isSel = c === selected;
              const isToday = c === TODAY;
              const hasOptions = evs.some((e) => e.category === "options_expiry");
              const dayTotal = trs.filter((t) => t.status === "closed").reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
              return (
                <button
                  key={i}
                  onClick={() => setSelected(c)}
                  className={`flex min-h-[84px] flex-col rounded-lg border p-1.5 text-left transition-colors ${
                    isSel ? "border-zinc-500 bg-zinc-800/60" : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isToday ? "text-emerald-400" : "text-zinc-300"}`}>
                      {Number(c.slice(-2))}
                    </span>
                    {hasOptions && (
                      <span className="rounded bg-violet-500/15 px-1 text-[9px] font-medium text-violet-400">OPX</span>
                    )}
                  </div>
                  {trs.length > 0 && (
                    <span
                      className={`mt-1 rounded px-1 py-0.5 text-[10px] font-medium tabular-nums ${
                        dayTotal > 0 ? "bg-emerald-500/15 text-emerald-400" : dayTotal < 0 ? "bg-rose-500/15 text-rose-400" : "bg-zinc-700/40 text-zinc-300"
                      }`}
                    >
                      {trs.length} trade{trs.length > 1 ? "s" : ""} · {signedUsd(dayTotal)}
                    </span>
                  )}
                  {evs.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-0.5 pt-1">
                      {evs.map((e) => (
                        <span key={e.id} title={`${e.name} (${e.impact})`} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: IMPACT_COLOR[e.impact] }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1"><ImpactDot impact="high" /> High</span>
            <span className="inline-flex items-center gap-1"><ImpactDot impact="medium" /> Medium</span>
            <span className="inline-flex items-center gap-1"><ImpactDot impact="low" /> Low</span>
            <span className="inline-flex items-center gap-1"><span className="rounded bg-violet-500/15 px-1 text-[9px] font-medium text-violet-400">OPX</span> Options expiry / witching</span>
          </div>
        </Panel>

        {/* day detail */}
        <Panel title={selected} subtitle="Trades & events for this day">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Events</p>
              {dayEvents.length === 0 ? (
                <p className="text-sm text-zinc-600">None</p>
              ) : (
                <ul className="space-y-2">
                  {dayEvents.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 text-sm">
                      <ImpactDot impact={e.impact} />
                      <span className="flex-1 text-zinc-200">{e.name}</span>
                      <span className="text-xs text-zinc-500">{CATEGORY_LABEL[e.category]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Trades</p>
              {dayTrades.length === 0 ? (
                <p className="text-sm text-zinc-600">No trades logged this day.</p>
              ) : (
                <ul className="space-y-2">
                  {dayTrades.map((t) => (
                    <li key={t.id}>
                      <Link href={`/trades/${t.id}`} className="block rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5 hover:bg-zinc-800/40">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-zinc-100">{t.underlying} {t.strategyLabel}</span>
                          <PnlValue value={t.realizedPnl} />
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <StatusBadge status={t.status} />
                          <TagBadge name={t.setupTag} category="setup" />
                          {NEEDS_JOURNALING(t) && <NeedsJournalingBadge />}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
