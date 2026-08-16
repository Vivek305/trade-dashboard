"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Table2,
  CalendarDays,
  NotebookPen,
  Settings,
  RefreshCw,
} from "lucide-react";
import { LAST_SYNC } from "@/lib/data";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/trades", label: "Trades", icon: Table2, exact: false },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, exact: false },
  { href: "/journal", label: "Journal", icon: NotebookPen, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
          <svg viewBox="0 0 32 32" className="h-5 w-5">
            <path d="M6 21 L13 12 L18 17 L26 7" stroke="#34d399" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">Trading Journal</p>
          <p className="text-[11px] text-zinc-500">SPY · SPX · ES</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-800/70 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <div className="rounded-lg bg-zinc-900/60 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Schwab connected
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Last sync {LAST_SYNC}</p>
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>
    </aside>
  );
}
