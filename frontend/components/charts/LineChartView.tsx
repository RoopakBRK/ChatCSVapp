"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber } from "@/lib/format";
import { AXIS_TEXT, GRID, PALETTE, TOOLTIP_STYLE, type Datum } from "./chartTheme";

export default function LineChartView({ data, x, y }: { data: Datum[]; x: string; y: string }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={x} tick={AXIS_TEXT} minTickGap={24} />
        <YAxis tick={AXIS_TEXT} tickFormatter={compactNumber} width={56} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Line type="monotone" dataKey={y} stroke={PALETTE[1]} strokeWidth={2.5} dot={data.length <= 24} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
