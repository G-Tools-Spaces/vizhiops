"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetricPoint } from "@/types/domain";

const RequestTimelineRenderer = dynamic(
  () => import("@/components/shared/chart-renderers").then((module) => module.RequestTimelineRenderer),
  { ssr: false, loading: () => <div className="h-full rounded-md bg-white/[0.03]" /> },
);

const TokenTimelineRenderer = dynamic(
  () => import("@/components/shared/chart-renderers").then((module) => module.TokenTimelineRenderer),
  { ssr: false, loading: () => <div className="h-full rounded-md bg-white/[0.03]" /> },
);

export function RequestTimeline({ data }: { data: MetricPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Timeline</CardTitle>
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
        <CardTitle>Token Consumption</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <TokenTimelineRenderer data={data} />
      </CardContent>
    </Card>
  );
}
