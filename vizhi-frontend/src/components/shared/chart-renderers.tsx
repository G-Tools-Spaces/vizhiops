"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricPoint } from "@/types/domain";

export function RequestTimelineRenderer({ data }: { data: MetricPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="requests" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4fd1a5" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#4fd1a5" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={42} />
        <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
        <Area dataKey="requests" stroke="#4fd1a5" fill="url(#requests)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TokenTimelineRenderer({ data }: { data: MetricPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
        <Bar dataKey="inputTokens" stackId="tokens" fill="#7cc7ff" radius={[4, 4, 0, 0]} />
        <Bar dataKey="outputTokens" stackId="tokens" fill="#f5c451" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
