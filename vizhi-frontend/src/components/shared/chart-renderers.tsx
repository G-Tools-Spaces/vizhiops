"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricPoint } from "@/types/domain";

const tooltipStyle = {
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 12,
} as const;

const gridStroke = "var(--line-soft)";

export function RequestTimelineRenderer({ data }: { data: MetricPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="requests" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={gridStroke} vertical={false} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={42} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area dataKey="requests" stroke="#6366f1" fill="url(#requests)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TokenTimelineRenderer({ data }: { data: MetricPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke={gridStroke} vertical={false} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="inputTokens" stackId="tokens" fill="#38bdf8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="outputTokens" stackId="tokens" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
