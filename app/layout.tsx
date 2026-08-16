import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { TODAY } from "@/lib/data";

export const metadata: Metadata = {
  title: "Trading Journal",
  description: "Personal trade journal & performance dashboard (static demo)",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* top bar */}
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-6 py-3 backdrop-blur">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-md bg-zinc-900 px-2 py-1 font-medium text-zinc-400 ring-1 ring-zinc-800">
                  Static demo — dummy data
                </span>
                <span>Mocked today: {TODAY}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">Single user</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-700">
                  T
                </div>
              </div>
            </header>

            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
