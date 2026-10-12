import { C, DocHeader, Endpoint, Fields, P, Section } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";
import { API_BASE_URL, API_PREFIX } from "@/lib/config";

export const metadata = { title: "Queries" };

const QUERY = `{
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
}`;

export default function QueriesPage() {
  return (
    <>
      <DocHeader eyebrow="Observability" title="Queries">
        Every call through the gateway is recorded as a query, joined with its
        response: tokens, latency, cost and status. This is the raw material the
        metrics and dashboard are built from.
      </DocHeader>

      <Section title="List queries">
        <Endpoint method="GET" path={`${API_PREFIX}/queries`}>
          The caller's queries, newest first, with optional filters.
        </Endpoint>
        <Fields
          title="Query parameters"
          rows={[
            { name: "agent_id", type: "string", description: "Restrict to one token (model token or agent)." },
            { name: "model", type: "string", description: "Restrict to one model name." },
            { name: "limit", type: "integer", description: "How many to return. Defaults to 50." },
          ]}
        />
        <CodeTabs
          sample={{
            python: `session.get("/queries", params={"limit": 20}).json()`,
            js: `await fetch("${API_BASE_URL}${API_PREFIX}/queries?limit=20", {
  credentials: "include",
}).then((r) => r.json());`,
            curl: `curl -s -b cookies.txt "${API_BASE_URL}${API_PREFIX}/queries?limit=20"`,
          }}
        />
        <ResponseBlock json={`[
  ${QUERY}
]`} />
      </Section>

      <Section title="Get one query">
        <Endpoint method="GET" path={`${API_PREFIX}/queries/{query_id}`}>
          A single query with its response, addressed by the{" "}
          <C>query_id</C> returned in <C>vizhi_metadata</C>.
        </Endpoint>
        <CodeTabs
          sample={{
            python: `session.get("/queries/q_7c8d9e0f1a2b").json()`,
            js: `await fetch("${API_BASE_URL}${API_PREFIX}/queries/q_7c8d9e0f1a2b", {
  credentials: "include",
}).then((r) => r.json());`,
            curl: `curl -s -b cookies.txt ${API_BASE_URL}${API_PREFIX}/queries/q_7c8d9e0f1a2b`,
          }}
        />
        <ResponseBlock json={QUERY} />
        <P>
          A query that is still in flight, or that never produced a response,
          returns <C>status</C>, <C>latency_ms</C> and token counts of{" "}
          <C>0</C>. A query belonging to another account returns <C>404</C>.
        </P>
      </Section>
    </>
  );
}
