import Link from "next/link";
import { Plus, Archive } from "lucide-react";
import { Panel, Button } from "@/components/ui";
import { TAGS, SYNC_LOG, LAST_SYNC } from "@/lib/data";
import { getSchwabConnectionStatus } from "./actions";
import { SchwabConnectionPanel } from "@/components/SchwabConnectionPanel";

function SyncStatus({ s }: { s: "success" | "partial" | "failed" }) {
  const map = {
    success: "bg-emerald-500/15 text-emerald-400",
    partial: "bg-amber-500/15 text-amber-400",
    failed: "bg-rose-500/15 text-rose-400",
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[s]}`}>{s}</span>
  );
}

function TagColumn({ category }: { category: "setup" | "mistake" }) {
  const tags = TAGS.filter((t) => t.category === category);
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {category === "setup" ? "Setup tags" : "Mistake tags"}
      </p>
      <ul className="space-y-2">
        {tags.map((t) => (
          <li key={t.name} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-2.5 py-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="flex-1 text-sm text-zinc-200">{t.name}</span>
            <button type="button" className="text-zinc-500 hover:text-zinc-300" title="Edit">
              <Archive className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function SettingsPage() {
  const schwabStatus = await getSchwabConnectionStatus();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Settings</h1>
        <p className="text-xs text-zinc-500">Connection, tags &amp; sync</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Schwab connection */}
        <Panel title="Schwab Connection" subtitle="Read-only · positions, transactions, price history">
          <SchwabConnectionPanel status={schwabStatus} />
          <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4 text-sm">
            <span className="text-zinc-500">Last sync</span>
            <span className="text-zinc-200">{LAST_SYNC}</span>
          </div>
        </Panel>

        {/* Sync log */}
        <Panel title="Sync History" subtitle="Most recent sync runs">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Started</th>
                  <th className="pb-2 text-right font-medium">Added</th>
                  <th className="pb-2 text-right font-medium">Updated</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {SYNC_LOG.map((s) => (
                  <tr key={s.id} className="border-t border-zinc-800">
                    <td className="py-2 text-zinc-300">{s.type}</td>
                    <td className="py-2 text-xs text-zinc-500">{s.startedAt}</td>
                    <td className="py-2 text-right tabular-nums text-zinc-300">{s.added}</td>
                    <td className="py-2 text-right tabular-nums text-zinc-300">{s.updated}</td>
                    <td className="py-2">
                      <SyncStatus s={s.status} />
                      {s.error && <p className="mt-0.5 text-[11px] text-rose-400/80">{s.error}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Tags */}
      <Panel
        title="Tag Management"
        subtitle="Controlled taxonomy for setups & mistakes"
        action={<Button><Plus className="h-3.5 w-3.5" /> Add tag</Button>}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <TagColumn category="setup" />
          <TagColumn category="mistake" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
          <input
            placeholder="New tag name…"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950/60 px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500"
          />
          <select className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200">
            <option>setup</option>
            <option>mistake</option>
          </select>
          <Button variant="primary">Add</Button>
        </div>
      </Panel>

      <p className="text-xs text-zinc-600">
        Screenshots are stored in private object storage and served via signed URLs. See{" "}
        <Link href="/trades/t1" className="text-zinc-500 underline hover:text-zinc-300">a trade</Link>{" "}
        for the gallery.
      </p>
    </div>
  );
}
