"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from "recharts";
import type { MarketBar } from "@/lib/data";

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: 8,
  fontSize: 12,
  color: "#e4e4e7",
};

export default function MarketSnapshotChart({ bars, underlying }: { bars: MarketBar[]; underlying: string }) {
  const entry = bars.find((b) => b.marker === "entry");
  const exit = bars.find((b) => b.marker === "exit");

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mkt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" vertical={false} />
          <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v) => v.toFixed(1)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#71717a" }}
            formatter={(v: number) => [v.toFixed(2), underlying]}
          />
          <Area type="monotone" dataKey="close" stroke="#38bdf8" strokeWidth={2} fill="url(#mkt)" />
          {entry && (
            <ReferenceDot x={entry.t} y={entry.close} r={4} fill="#34d399" stroke="#0a0a0a" strokeWidth={1.5} />
          )}
          {exit && (
            <ReferenceDot x={exit.t} y={exit.close} r={4} fill="#f43f5e" stroke="#0a0a0a" strokeWidth={1.5} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
