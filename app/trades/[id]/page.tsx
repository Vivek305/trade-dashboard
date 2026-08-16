import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import MarketSnapshotChart from "@/components/MarketSnapshotChart";
import { Panel, StatusBadge, NeedsJournalingBadge, PnlValue, ImpactDot, Button, Confidence } from "@/components/ui";
import { TRADES, tradeById, ECON_EVENTS, IMPACT_COLOR, TAGS, type Trade } from "@/lib/data";
import { usd, dateTime, day, holdTime } from "@/lib/format";

export function generateStaticParams() {
  return TRADES.map((t) => ({ id: t.id }));
}

function RO({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800/60 py-2 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-200">{value}</span>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-700 bg-zinc-950/60 px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function Screenshot({ label, tone }: { label: string; tone: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <div className={`flex h-28 items-center justify-center ${tone}`}>
        <Camera className="h-6 w-6 text-zinc-500" />
      </div>
      <div className="bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-400">{label}</div>
    </div>
  );
}

export default async function TradeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t: Trade | undefined = tradeById(id);
  if (!t) notFound();

  const dayEvents = ECON_EVENTS.filter((e) => e.datetime.slice(0, 10) === t.entry.slice(0, 10));
  const setups = TAGS.filter((x) => x.category === "setup");
  const mistakes = TAGS.filter((x) => x.category === "mistake");

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/trades" className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            <ArrowLeft className="h-3.5 w-3.5" /> All trades
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-zinc-100">
              {t.underlying} {t.strategyLabel}
            </h1>
            <StatusBadge status={t.status} />
            {t.setupTag == null && <NeedsJournalingBadge />}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {day(t.entry)} · {t.dte} DTE · x{t.quantity} · hold {holdTime(t.entry, t.exit)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Realized P&L</p>
          <p className="text-2xl font-semibold">
            <PnlValue value={t.realizedPnl} />
          </p>
        </div>
      </div>

      {/* main grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel
            title="Market Context"
            subtitle={`${t.underlying} close around entry/exit · VIX ${t.vixAtEntry} → ${t.vixAtExit ?? "—"}`}
            action={
              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> entry</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> exit</span>
              </div>
            }
          >
            <MarketSnapshotChart bars={t.bars} underlying={t.underlying} />
          </Panel>

          <Panel title="Legs" subtitle={`${t.legs.length} legs · ${t.strategyLabel}`}>
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="pb-2 font-medium">Side</th>
                    <th className="pb-2 font-medium">Option</th>
                    <th className="pb-2 font-medium">Strike</th>
                    <th className="pb-2 font-medium">Exp</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Price</th>
                    <th className="pb-2 text-right font-medium">Δ</th>
                    <th className="pb-2 text-right font-medium">Θ</th>
                    <th className="pb-2 text-right font-medium">Vega</th>
                  </tr>
                </thead>
                <tbody>
                  {t.legs.map((l) => (
                    <tr key={l.optionSymbol} className="border-t border-zinc-800">
                      <td className="py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            l.action === "sell_to_open" ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"
                          }`}
                        >
                          {l.action === "sell_to_open" ? "Sell" : "Buy"}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs text-zinc-300">{l.optionSymbol}</td>
                      <td className="py-2 tabular-nums text-zinc-300">{l.strike}</td>
                      <td className="py-2 text-xs text-zinc-500">{day(l.expiration)}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-300">{l.quantity}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-300">{l.price.toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-400">{l.greeks.delta.toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-400">{l.greeks.theta.toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-400">{l.greeks.vega.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Screenshots"
            subtitle="Entry · Exit · Management"
            action={<Button><Camera className="h-3.5 w-3.5" /> Upload / paste</Button>}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Screenshot label="Entry · 2:02 PM" tone="bg-gradient-to-br from-zinc-800 to-zinc-900" />
              <Screenshot label="Exit · 7:45 PM" tone="bg-gradient-to-br from-emerald-900/40 to-zinc-900" />
              <Screenshot label="Management" tone="bg-gradient-to-br from-sky-900/40 to-zinc-900" />
            </div>
          </Panel>
        </div>

        {/* right column: related events */}
        <div className="space-y-4">
          <Panel title="Events That Day" subtitle={day(t.entry)}>
            {dayEvents.length === 0 ? (
              <p className="text-sm text-zinc-500">No scheduled events on this date.</p>
            ) : (
              <ul className="space-y-3">
                {dayEvents.map((e) => (
                  <li key={e.id} className="flex items-start gap-3">
                    <div className="mt-1"><ImpactDot impact={e.impact} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-200">{e.name}</p>
                      <p className="text-xs text-zinc-500">{e.datetime.split(" ")[1]} · {e.category}</p>
                      {(e.forecast || e.actual) && (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {e.actual && <>Actual <span className="text-zinc-300">{e.actual}</span></>}
                          {e.forecast && <> · Forecast <span className="text-zinc-300">{e.forecast}</span></>}
                        </p>
                      )}
                    </div>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: IMPACT_COLOR[e.impact], backgroundColor: `${IMPACT_COLOR[e.impact]}1a` }}>
                      {e.impact}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* auto vs manual */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Auto-populated" subtitle="From Schwab · read-only">
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <div>
              <RO label="Underlying" value={t.underlying} />
              <RO label="Instrument" value="Vertical spread" />
              <RO label="Strategy" value={`${t.strategyLabel} · ${t.dte}DTE`} />
              <RO label="Entry" value={dateTime(t.entry)} />
              <RO label="Exit" value={t.exit ? dateTime(t.exit) : "—"} />
              <RO label="Entry price" value={`$${t.entryPrice.toFixed(2)}/ct`} />
            </div>
            <div>
              <RO label="Exit price" value={t.exitPrice != null ? `$${t.exitPrice.toFixed(2)}/ct` : "—"} />
              <RO label="Quantity" value={t.quantity} />
              <RO label="Fees" value={usd(t.fees)} />
              <RO label="Max risk" value={usd(t.maxRisk)} />
              <RO label="Size (% acct)" value={`${t.positionSizePct}%`} />
              <RO label="VIX in → out" value={`${t.vixAtEntry} → ${t.vixAtExit ?? "—"}`} />
            </div>
          </div>
        </Panel>

        <Panel title="Journal" subtitle="Manual fields · editable" action={<Button variant="primary">Save</Button>}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Setup tag">
              <select className={inputCls} defaultValue={t.setupTag ?? ""}>
                <option value="">—</option>
                {setups.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Mistake tag">
              <select className={inputCls} defaultValue={t.mistakeTag ?? ""}>
                <option value="">—</option>
                {mistakes.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Confidence">
              <div className="flex h-[38px] items-center"><Confidence level={t.confidence} /></div>
            </Field>
            <Field label="HTF bias">
              <select className={inputCls} defaultValue={t.htfBias ?? ""}>
                <option value="">—</option>
                <option value="bullish">bullish</option>
                <option value="bearish">bearish</option>
                <option value="neutral">neutral</option>
              </select>
            </Field>
            <Field label="Levels used">
              <input className={inputCls} defaultValue={t.levelsUsed ?? ""} placeholder="resistance 775, support 770" />
            </Field>
            <Field label="Realized vs planned">
              <select className={inputCls} defaultValue={t.realizedVsPlanned ?? ""}>
                <option value="">—</option>
                <option value="per_plan">per plan</option>
                <option value="early">early</option>
                <option value="late">late</option>
                <option value="stopped_out">stopped out</option>
                <option value="other">other</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Reasoning">
                <textarea className={`${inputCls} min-h-[64px]`} defaultValue={t.reasoning ?? ""} placeholder="Why was this trade taken?" />
              </Field>
            </div>
            <Field label="Planned exit">
              <input className={inputCls} defaultValue={t.plannedExit ?? ""} placeholder="price / condition" />
            </Field>
            <Field label="Emotional state">
              <input className={inputCls} defaultValue={t.emotionalState ?? ""} placeholder="calm, anxious, fomo…" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-zinc-400 sm:col-span-2">
              <input type="checkbox" defaultChecked={t.highImpactNewsDay} className="h-4 w-4 rounded border-zinc-700 bg-zinc-950" />
              High-impact news day
            </label>
          </div>
        </Panel>
      </div>
    </div>
  );
}
