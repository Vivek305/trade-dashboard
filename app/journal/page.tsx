"use client";

import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { Panel, Button, TagBadge } from "@/components/ui";
import { JOURNAL, type JournalEntry } from "@/lib/data";
import { day, pct, signedUsd } from "@/lib/format";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const c = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-zinc-200";
  return (
    <div className="rounded-lg bg-zinc-950/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${c}`}>{value}</p>
    </div>
  );
}

function EntryCard({ e }: { e: JournalEntry }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">{day(e.date)}</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">{e.type}</span>
            {e.mood && <span className="text-xs text-zinc-500">· feeling {e.mood}</span>}
          </div>
          {e.marketBias && (
            <p className="mt-2 text-xs">
              <span className="text-zinc-500">Bias: </span>
              <span className="text-zinc-300">{e.marketBias}</span>
            </p>
          )}
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{e.notes}</p>
        </div>
        <div className="space-y-2">
          <Stat label="P&L" value={signedUsd(e.stats.pnl)} tone={e.stats.pnl >= 0 ? "good" : "bad"} />
          <Stat label="Win rate" value={e.stats.winRate == null ? "—" : pct(e.stats.winRate, 0)} />
          <div className="rounded-lg bg-zinc-950/50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Top mistake</p>
            <div className="mt-1"><TagBadge name={e.stats.topMistake} category="mistake" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JournalPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");

  const rows = useMemo(() => {
    let r = [...JOURNAL];
    if (type !== "all") r = r.filter((e) => e.type === type);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(
        (e) =>
          e.notes.toLowerCase().includes(s) ||
          (e.marketBias ?? "").toLowerCase().includes(s) ||
          e.date.includes(s)
      );
    }
    return r;
  }, [q, type]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Journal</h1>
          <p className="text-xs text-zinc-500">Daily &amp; weekly reflections · {rows.length} entries</p>
        </div>
        <Button variant="primary"><Plus className="h-3.5 w-3.5" /> New entry</Button>
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notes, bias, date…"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950/60 py-1.5 pl-8 pr-3 text-sm text-zinc-200 outline-none focus:border-zinc-500"
            />
          </div>
          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5">
            {["all", "daily", "weekly"].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  type === t ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((e) => (
            <EntryCard key={e.id} e={e} />
          ))}
          {rows.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No entries match your search.</p>}
        </div>
      </Panel>
    </div>
  );
}
