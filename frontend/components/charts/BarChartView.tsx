"use client";

import { useId } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber } from "@/lib/format";
import { AXIS_TEXT, GRID, TOOLTIP_STYLE, type Datum } from "./chartTheme";

export default function BarChartView({ data, x, y }: { data: Datum[]; x: string; y: string }) {
  const gradient = `bar-${useId().replace(/:/g, "")}`;
  // Tilt the labels when there are many bars, or when long names would run into each other.
  const longest = Math.max(0, ...data.map((d) => String(d[x] ?? "").length));
  const crowded = data.length > 8 || longest * data.length > 36;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: crowded ? 48 : 0 }}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={x} tick={AXIS_TEXT} angle={crowded ? -30 : 0} textAnchor={crowded ? "end" : "middle"} interval={0} />
        <YAxis tick={AXIS_TEXT} tickFormatter={compactNumber} width={56} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(129,140,248,0.12)" }} />
        <Bar dataKey={y} fill={`url(#${gradient})`} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
