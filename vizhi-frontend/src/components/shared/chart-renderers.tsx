"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricPoint } from "@/types/domain";

// Accent blue family (matches --brand / --accent in globals.css).
const ACCENT = "#3b82f6";
const ACCENT_LIGHT = "#93c5fd";

const tooltipStyle = {
  background: "var(--panel)",
  border: "1px solid var(--line-strong)",
  borderRadius: 0,
  color: "var(--ink)",
  fontSize: 12,
} as const;

const gridStroke = "var(--line-soft)";
const cursor = { fill: "var(--surface-strong)" };

export function RequestTimelineRenderer({ data }: { data: MetricPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="requests" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={gridStroke} vertical={false} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={42} fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--line-strong)" }} />
        <Area type="linear" dataKey="requests" stroke={ACCENT} fill="url(#requests)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TokenTimelineRenderer({ data }: { data: MetricPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke={gridStroke} vertical={false} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={48} fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} cursor={cursor} />
        <Bar dataKey="inputTokens" name="Input" stackId="tokens" fill={ACCENT} />
        <Bar dataKey="outputTokens" name="Output" stackId="tokens" fill={ACCENT_LIGHT} />
      </BarChart>
    </ResponsiveContainer>
  );
}
