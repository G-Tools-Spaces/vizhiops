import { C, DocHeader, Endpoint, Fields, P, Section } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";
import { API_BASE_URL, API_PREFIX } from "@/lib/config";

export const metadata = { title: "Metrics" };

export default function MetricsPage() {
  return (
    <>
      <DocHeader eyebrow="Observability" title="Metrics">
        The same queries, aggregated into a time series for charts, plus the
        recent requests that feed a table. One call powers a monitoring page.
      </DocHeader>

      <Section title="Get metrics">
        <Endpoint method="GET" path={`${API_PREFIX}/metrics`}>
          A bucketed time series of requests, tokens, latency and errors, plus
          the most recent requests in the window.
        </Endpoint>
        <Fields
          title="Query parameters"
          rows={[
            {
              name: "time_range",
              type: "string",
              description: (
                <>
                  <C>1h</C>, <C>24h</C>, <C>7d</C> or <C>30d</C>. Defaults to{" "}
                  <C>24h</C>.
                </>
              ),
            },
            { name: "agent_id", type: "string", description: "Restrict to one token (agent CID)." },
            { name: "model_id", type: "string", description: "Restrict to one model name." },
          ]}
        />
        <CodeTabs
          sample={{
            python: `session.get("/metrics", params={"time_range": "7d"}).json()`,
            js: `await fetch("${API_BASE_URL}${API_PREFIX}/metrics?time_range=7d", {
  credentials: "include",
}).then((r) => r.json());`,
            curl: `curl -s -b cookies.txt "${API_BASE_URL}${API_PREFIX}/metrics?time_range=7d"`,
          }}
        />
        <ResponseBlock
          json={`{
  "metric_series": [
    {
      "time": "2026-09-24T00:00:00.000000",
      "requests": 41,
      "input_tokens": 30120,
      "output_tokens": 7011,
      "latency": 402,
      "errors": 0
    },
    {
      "time": "2026-09-25T00:00:00.000000",
      "requests": 18,
      "input_tokens": 12044,
      "output_tokens": 2901,
      "latency": 388,
      "errors": 1
    }
  ],
  "requests": [
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
          <C>metric_series</C> is bucketed to suit the range — hourly for{" "}
          <C>1h</C>/<C>24h</C>, daily for <C>7d</C>/<C>30d</C>.{" "}
          <C>latency</C> is the average for the bucket in milliseconds.
        </P>
      </Section>
    </>
  );
}
