import { C, DocHeader, Endpoint, P, Section } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";
import { TryIt } from "@/components/TryIt";
import { API_BASE_URL, API_PREFIX } from "@/lib/config";

export const metadata = { title: "Provider health" };

const HEALTH = `{
  "overall_status": "operational",
  "providers": [
    {
      "provider": "openai",
      "label": "OpenAI",
      "status": "operational",
      "latency_ms": 210,
      "last_checked": "2026-09-25T06:12:00.000000",
      "message": "OK",
      "incident_count": 0
    },
    {
      "provider": "anthropic",
      "label": "Claude (Anthropic)",
      "status": "degraded",
      "latency_ms": 1480,
      "last_checked": "2026-09-25T06:12:00.000000",
      "message": "Elevated latency",
      "incident_count": 1
    }
  ],
  "checked_at": "2026-09-25T06:12:41.000000"
}`;

export default function HealthPage() {
  return (
    <>
      <DocHeader eyebrow="Observability" title="Provider health">
        The current status of every configured AI provider, probed in the
        background. This is what the console's Provider Health page reads.
      </DocHeader>

      <Section title="Get provider health">
        <Endpoint method="GET" path={`${API_PREFIX}/health/providers`}>
          Every provider with its current status, served from the in-memory
          cache the background loop refreshes every 60 seconds.
        </Endpoint>
        <CodeTabs
          sample={{
            python: `import httpx

httpx.get("${API_BASE_URL}${API_PREFIX}/health/providers").json()`,
            js: `await fetch("${API_BASE_URL}${API_PREFIX}/health/providers").then((r) => r.json());`,
            curl: `curl -s ${API_BASE_URL}${API_PREFIX}/health/providers`,
          }}
        />
        <ResponseBlock json={HEALTH} />
        <TryIt method="GET" path={`${API_PREFIX}/health/providers`} />
        <P>
          A provider's <C>status</C> is <C>operational</C>,{" "}
          <C>degraded</C>, <C>down</C>, <C>unknown</C> or <C>unconfigured</C>.
          The <C>overall_status</C> rolls these up: <C>operational</C>,{" "}
          <C>degraded</C>, <C>partial_outage</C> or <C>major_outage</C>.
        </P>
      </Section>

      <Section title="Force a refresh">
        <Endpoint method="POST" path={`${API_PREFIX}/health/providers/refresh`}>
          Run an immediate probe of all providers and return fresh results,
          rather than waiting for the next scheduled pass. This is what the
          console's Refresh button calls.
        </Endpoint>
        <CodeTabs
          sample={{
            python: `httpx.post("${API_BASE_URL}${API_PREFIX}/health/providers/refresh").json()`,
            js: `await fetch("${API_BASE_URL}${API_PREFIX}/health/providers/refresh", {
  method: "POST",
}).then((r) => r.json());`,
            curl: `curl -s -X POST ${API_BASE_URL}${API_PREFIX}/health/providers/refresh`,
          }}
        />
        <ResponseBlock json={HEALTH} />
      </Section>
    </>
  );
}
