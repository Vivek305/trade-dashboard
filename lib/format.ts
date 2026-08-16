// Small formatting helpers shared across the static demo pages.

export const usd = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

/** signed currency: +$1,120.00 / -$1,500.00 */
export const signedUsd = (n: number, digits = 2) => (n >= 0 ? "+" : "-") + usd(Math.abs(n), digits);

export const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

/** "2026-08-13 14:32" -> "Aug 13, 2:32 PM" */
export function dateTime(s: string | null): string {
  if (!s) return "—";
  const [d, t] = s.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const dt = new Date(y, m - 1, day, hh, mm);
  return dt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "2026-08-13 14:32" -> "Aug 13" */
export function day(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.split(" ")[0].split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function weekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}

export function holdTime(entry: string, exit: string | null): string {
  if (!exit) return "open";
  const toMin = (s: string) => {
    const [d, t] = s.split(" ");
    const [y, m, day] = d.split("-").map(Number);
    const [hh, mm] = t.split(":").map(Number);
    return new Date(y, m - 1, day, hh, mm).getTime() / 60000;
  };
  const mins = Math.round(toMin(exit) - toMin(entry));
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return h ? `${h}h ${r}m` : `${r}m`;
}
