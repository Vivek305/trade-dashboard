import type { ReactNode } from "react";
import { tagColor } from "@/lib/data";

// ---------------------------------------------------------------------------
// Presentational primitives (shadcn/ui-inspired, dark-mode-first)
// ---------------------------------------------------------------------------

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-sm ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "good" | "bad";
  children?: ReactNode;
}) {
  const toneText =
    tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneText}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
      {children}
    </div>
  );
}

export function TagBadge({ name, category }: { name: string | null; category: "setup" | "mistake" }) {
  if (!name) return <span className="text-xs text-zinc-600">—</span>;
  const color = tagColor(name);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{
        color: color ?? "#a1a1aa",
        borderColor: `${color ?? "#3f3f46"}66`,
        backgroundColor: `${color ?? "#3f3f46"}1a`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
      {category === "mistake" && <span className="text-zinc-500">✗</span>}
    </span>
  );
}

export function StatusBadge({ status }: { status: "open" | "closed" }) {
  const open = status === "open";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        open ? "bg-sky-500/15 text-sky-400" : "bg-zinc-700/40 text-zinc-400"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-sky-400" : "bg-zinc-500"}`} />
      {open ? "Open" : "Closed"}
    </span>
  );
}

export function NeedsJournalingBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
      ⚑ needs journaling
    </span>
  );
}

export function PnlValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-zinc-600">—</span>;
  const good = value > 0;
  return (
    <span className={`tabular-nums font-medium ${good ? "text-emerald-400" : "text-rose-400"}`}>
      {value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString()}
    </span>
  );
}

export function ImpactDot({ impact }: { impact: "high" | "medium" | "low" }) {
  const c = impact === "high" ? "bg-rose-500" : impact === "medium" ? "bg-amber-400" : "bg-sky-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${c}`} />;
}

/** Visual-only button for the static demo. */
export function Button({
  children,
  variant = "secondary",
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
      : variant === "secondary"
      ? "border border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-800"
      : "text-zinc-300 hover:bg-zinc-800/60";
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange?: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange?.(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.value ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Confidence({ level }: { level: number | null }) {
  if (level == null) return <span className="text-xs text-zinc-600">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i <= level ? "bg-emerald-400" : "bg-zinc-700"}`}
        />
      ))}
    </span>
  );
}
