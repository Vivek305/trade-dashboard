"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronDown, ChevronUp, Flag } from "lucide-react";
import { Panel, TagBadge, StatusBadge, NeedsJournalingBadge, PnlValue, Button } from "@/components/ui";
import { TRADES, TAGS, TODAY, NEEDS_JOURNALING, type Trade } from "@/lib/data";
import { day, dateTime } from "@/lib/format";

type SortKey = "date" | "underlying" | "strategy" | "pnl" | "status";
type WinLoss = "all" | "win" | "loss";
type DateRange = "all" | "today" | "week";

const DAY_MS = 86400000;
const d = (iso: string) => {
  const [y, m, dd] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, dd).getTime();
};

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-zinc-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function TradesPage() {
  const [instrument, setInstrument] = useState("all");
  const [setup, setSetup] = useState("all");
  const [mistake, setMistake] = useState("all");
  const [winloss, setWinloss] = useState<WinLoss>("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState<DateRange>("all");
  const [needsOnly, setNeedsOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });

  const rows = useMemo(() => {
    let r = [...TRADES];
    if (instrument !== "all") r = r.filter((t) => t.underlying === instrument);
    if (setup !== "all") r = r.filter((t) => t.setupTag === setup);
    if (mistake !== "all") r = r.filter((t) => t.mistakeTag === mistake);
    if (status !== "all") r = r.filter((t) => t.status === status);
    if (winloss !== "all")
      r = r.filter((t) => (winloss === "win" ? (t.realizedPnl ?? 0) > 0 : (t.realizedPnl ?? 0) <= 0));
    if (range === "today") r = r.filter((t) => t.entry.slice(0, 10) === TODAY);
    if (range === "week") r = r.filter((t) => d(TODAY) - d(t.entry) < 7 * DAY_MS);
    if (needsOnly) r = r.filter(NEEDS_JOURNALING);

    const dir = sort.dir;
    r.sort((a, b) => {
      switch (sort.key) {
        case "underlying":
          return dir * a.underlying.localeCompare(b.underlying);
        case "strategy":
          return dir * a.strategyLabel.localeCompare(b.strategyLabel);
        case "pnl":
          return dir * ((a.realizedPnl ?? -Infinity) - (b.realizedPnl ?? -Infinity));
        case "status":
          return dir * a.status.localeCompare(b.status);
        default:
          return dir * a.entry.localeCompare(b.entry);
      }
    });
    return r;
  }, [instrument, setup, mistake, winloss, status, range, needsOnly, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));

  const Th = ({ k, children, className = "" }: { k?: SortKey; children: ReactNode; className?: string }) => (
    <th className={`pb-2 font-medium ${className}`}>
      {k ? (
        <button
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-zinc-300 ${sort.key === k ? "text-zinc-200" : ""}`}
        >
          {children}
          {sort.key === k ? (
            sort.dir === -1 ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronUp className="h-3 w-3" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Trades</h1>
          <p className="text-xs text-zinc-500">
            {rows.length} of {TRADES.length} trades · 0DTE credit spreads
          </p>
        </div>
        <Button>Bulk tag</Button>
      </div>

      <Panel>
        {/* filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select
            label="Date"
            value={range}
            onChange={(v) => setRange(v as DateRange)}
            options={[
              { value: "all", label: "All time" },
              { value: "today", label: "Today" },
              { value: "week", label: "Last 7 days" },
            ]}
          />
          <Select
            label="Instrument"
            value={instrument}
            onChange={setInstrument}
            options={[
              { value: "all", label: "All" },
              { value: "SPY", label: "SPY" },
              { value: "SPX", label: "SPX" },
            ]}
          />
          <Select
            label="Setup"
            value={setup}
            onChange={setSetup}
            options={[{ value: "all", label: "All" }, ...TAGS.filter((t) => t.category === "setup").map((t) => ({ value: t.name, label: t.name }))]}
          />
          <Select
            label="Mistake"
            value={mistake}
            onChange={setMistake}
            options={[{ value: "all", label: "All" }, ...TAGS.filter((t) => t.category === "mistake").map((t) => ({ value: t.name, label: t.name }))]}
          />
          <Select
            label="Result"
            value={winloss}
            onChange={(v) => setWinloss(v as WinLoss)}
            options={[
              { value: "all", label: "All" },
              { value: "win", label: "Wins" },
              { value: "loss", label: "Losses" },
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
            ]}
          />
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <button
              type="button"
              onClick={() => setNeedsOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors ${
                needsOnly
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              <Flag className="h-3.5 w-3.5" /> Needs journaling
            </button>
          </label>
        </div>

        {/* table */}
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <Th k="date">Date</Th>
                <Th k="underlying">Underlying</Th>
                <Th k="strategy">Strategy</Th>
                <Th>Entry / Exit</Th>
                <Th k="pnl" className="text-right">P&L</Th>
                <Th>Setup</Th>
                <Th>Mistake</Th>
                <Th k="status">Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t: Trade) => (
                <tr key={t.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                  <td className="py-2.5 text-zinc-300">{day(t.entry)}</td>
                  <td className="py-2.5">
                    <Link href={`/trades/${t.id}`} className="font-medium text-zinc-100 hover:text-emerald-400">
                      {t.underlying}
                    </Link>
                  </td>
                  <td className="py-2.5 text-zinc-400">
                    {t.strategyLabel} · {t.dte}DTE
                    <span className="ml-2 text-xs text-zinc-600">x{t.quantity}</span>
                  </td>
                  <td className="py-2.5 text-xs text-zinc-500">
                    {dateTime(t.entry)}
                    <br />
                    {t.exit ? dateTime(t.exit) : "open"}
                  </td>
                  <td className="py-2.5 text-right">
                    <PnlValue value={t.realizedPnl} />
                  </td>
                  <td className="py-2.5">
                    <TagBadge name={t.setupTag} category="setup" />
                  </td>
                  <td className="py-2.5">
                    <TagBadge name={t.mistakeTag} category="mistake" />
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={t.status} />
                      {NEEDS_JOURNALING(t) && <NeedsJournalingBadge />}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-zinc-500">
                    No trades match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
