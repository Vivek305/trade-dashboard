"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Terminal } from "lucide-react";
import { testSchwabConnection, type SchwabConnectionStatus } from "@/app/settings/actions";

export function SchwabConnectionPanel({ status }: { status: SchwabConnectionStatus }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleTest() {
    setResult(null);
    startTransition(async () => {
      setResult(await testSchwabConnection());
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <span className={`h-2 w-2 rounded-full ${status.connected ? "bg-emerald-400" : "bg-rose-400"}`} />
            {status.connected ? "Connected" : "Not connected"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">Read-only · OAuth · positions, transactions, price history</p>
        </div>
        <button
          type="button"
          onClick={handleTest}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          {isPending ? "Testing…" : "Test connection"}
        </button>
      </div>

      {result && (
        <p className={`text-xs ${result.ok ? "text-emerald-400" : "text-rose-400"}`}>{result.message}</p>
      )}

      {status.needsReauthSoon && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Schwab refresh tokens expire ~7 days after connecting — re-run{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5">npm run schwab:auth</code> soon.
        </p>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500">Last connected / refreshed</span>
        <span className="text-zinc-200">{status.lastConnectedAt ?? "—"}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500">Access token expires</span>
        <span className="text-zinc-200">{status.accessTokenExpiresAt ?? "—"}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500">Sync cadence</span>
        <span className="text-zinc-200">Manual (end-of-day)</span>
      </div>

      <p className="flex items-start gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500">
        <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        To connect or reconnect, run <code className="rounded bg-zinc-800 px-1 py-0.5">npm run schwab:auth</code> on
        your machine — the browser-based login can&apos;t be triggered from this page.
      </p>
    </div>
  );
}
