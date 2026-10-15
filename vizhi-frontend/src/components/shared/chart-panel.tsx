"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetricPoint } from "@/types/domain";

const placeholder = () => <div className="h-full bg-[var(--surface)]" />;

const RequestTimelineRenderer = dynamic(
  () => import("@/components/shared/chart-renderers").then((module) => module.RequestTimelineRenderer),
  { ssr: false, loading: placeholder },
);

const TokenTimelineRenderer = dynamic(
  () => import("@/components/shared/chart-renderers").then((module) => module.TokenTimelineRenderer),
  { ssr: false, loading: placeholder },
);

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex items-center gap-3 text-xs text-[var(--ink-tertiary)]">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function RequestTimeline({ data }: { data: MetricPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Request timeline</CardTitle>
        <Legend items={[{ label: "Requests", color: "#3b82f6" }]} />
      </CardHeader>
      <CardContent className="h-72">
        <RequestTimelineRenderer data={data} />
      </CardContent>
    </Card>
  );
}

export function TokenTimeline({ data }: { data: MetricPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Token consumption</CardTitle>
        <Legend
          items={[
            { label: "Input", color: "#3b82f6" },
            { label: "Output", color: "#93c5fd" },
          ]}
        />
      </CardHeader>
      <CardContent className="h-72">
        <TokenTimelineRenderer data={data} />
      </CardContent>
    </Card>
  );
}
