import { C, DocHeader, Endpoint, P, Section } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";
import { API_BASE_URL, API_PREFIX } from "@/lib/config";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <DocHeader eyebrow="Observability" title="Dashboard">
        One combined payload for the console home page: headline totals, a
        metric series, and the most recent requests — everything a dashboard
        needs in a single round trip.
      </DocHeader>

      <Section title="Get the dashboard">
        <Endpoint method="GET" path={`${API_PREFIX}/dashboard`}>
          Totals, a metric series and recent requests, scoped to the caller.
        </Endpoint>
        <CodeTabs
          sample={{
            python: `session.get("/dashboard").json()`,
            js: `await fetch("${API_BASE_URL}${API_PREFIX}/dashboard", {
  credentials: "include",
}).then((r) => r.json());`,
            curl: `curl -s -b cookies.txt ${API_BASE_URL}${API_PREFIX}/dashboard`,
          }}
        />
        <ResponseBlock
          json={`{
  "totals": {
    "agents": 3,
    "model_tokens": 5,
    "requests_today": 18,
    "tokens_consumed": 111254,
    "errors": 1,
    "active_models": 4
  },
  "metric_series": [
    {
      "time": "2026-09-25T00:00:00.000000",
      "requests": 18,
      "input_tokens": 12044,
      "output_tokens": 2901,
      "latency": 388,
      "errors": 1
    }
  ],
  "recent_requests": [
    {
      "id": "q_7c8d9e0f1a2b",
      "timestamp": "2026-09-25T06:12:41.000000",
      "agent_id": "mt_1a2b3c4d",
      "model": "gpt-4o-mini",
      "provider": "openai",
      "endpoint": "/v1/chat/completions",
      "status": 200,
      "latency_ms": 388,
      "input_tokens": 12,
      "output_tokens": 9,
      "estimated_cost": 0.000012,
      "error_message": null,
      "prompt": [],
      "response_text": ""
    }
  ]
}`}
        />
        <P>
          <C>totals</C> is the headline row: how many agents and model tokens
          exist, today's request and token counts, errors, and how many
          models are currently active. The series and recent requests match the
          shapes documented under{" "}
          <a href="/docs/metrics" className="text-accent hover:underline">
            Metrics
          </a>{" "}
          and{" "}
          <a href="/docs/queries" className="text-accent hover:underline">
            Queries
          </a>
          .
        </P>
      </Section>
    </>
  );
}
