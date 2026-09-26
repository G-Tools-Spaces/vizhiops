import { C, Callout, DocHeader, Endpoint, Fields, P, Section } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";
import { API_BASE_URL, API_PREFIX } from "@/lib/config";

export const metadata = { title: "Agents" };

const AGENT = `{
  "id": "a1b2c3d4e5f6",
  "agent_id": "ag_9f3c1d2e4a",
  "name": "Support bot",
  "description": "Answers customer tickets",
  "token_name": "Production",
  "tags": ["support", "prod"],
  "status": "active",
  "masked_key": "vk_…9f3c",
  "last_used_at": "2026-09-25T06:12:41.000000",
  "created_at": "2026-09-20T17:02:11.000000",
  "updated_at": "2026-09-24T09:40:03.000000"
}`;

export default function AgentsPage() {
  return (
    <>
      <DocHeader eyebrow="Core resources" title="Agents">
        An agent is a gateway credential for an on-site worker. Calls made with
        an agent token are queued and fulfilled by your own agent process over
        the agent queue, rather than by a provider Vizhi connects to directly.
      </DocHeader>

      <Callout title="Console session required">
        Agents are managed by a signed-in person. Creating, updating, rotating
        and budgeting all need the console session cookie — a <C>vk_</C> token
        cannot manage credentials.
      </Callout>

      <Section title="Create an agent">
        <Endpoint method="POST" path={`${API_PREFIX}/agents`}>
          Create an agent and mint its gateway token. The raw token is returned
          once, here, and never again.
        </Endpoint>
        <Fields
          rows={[
            { name: "name", type: "string", required: true, description: "At least 2 characters." },
            { name: "description", type: "string", description: "What the agent does." },
            { name: "tags", type: "string", description: "Comma-separated tags, e.g. \"support, prod\"." },
            { name: "token_name", type: "string | null", description: "A friendly label for this token." },
          ]}
        />
        <CodeTabs
          sample={{
            python: `agent = session.post("/agents", json={
    "name": "Support bot",
    "description": "Answers customer tickets",
    "tags": "support, prod",
}).json()

# Store agent["api_key"] now — it is never shown again.`,
            js: `const agent = await fetch("${API_BASE_URL}${API_PREFIX}/agents", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Support bot",
    description: "Answers customer tickets",
    tags: "support, prod",
  }),
}).then((r) => r.json());

// Store agent.api_key now — it is never shown again.`,
            curl: `curl -s -b cookies.txt -X POST ${API_BASE_URL}${API_PREFIX}/agents \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Support bot","description":"Answers customer tickets","tags":"support, prod"}'`,
          }}
        />
        <ResponseBlock
          status={201}
          json={`{
  "agent": ${AGENT},
  "api_key": "vk_9f3c1d2e4a5b6c7d8e9f0a1b2c3d4e5f"
}`}
        />
      </Section>

      <Section title="List agents">
        <Endpoint method="GET" path={`${API_PREFIX}/agents`}>
          Every agent the caller owns, newest first.
        </Endpoint>
        <CodeTabs
          sample={{
            python: `session.get("/agents").json()`,
            js: `await fetch("${API_BASE_URL}${API_PREFIX}/agents", {
  credentials: "include",
}).then((r) => r.json());`,
            curl: `curl -s -b cookies.txt ${API_BASE_URL}${API_PREFIX}/agents`,
          }}
        />
        <ResponseBlock json={`[
  ${AGENT}
]`} />
      </Section>

      <Section title="Get one agent">
        <Endpoint method="GET" path={`${API_PREFIX}/agents/{agent_id}`}>
          A single agent, addressed by its CID (<C>ag_…</C>).
        </Endpoint>
        <ResponseBlock json={AGENT} />
      </Section>

      <Section title="Update an agent">
        <Endpoint method="PATCH" path={`${API_PREFIX}/agents/{agent_id}`}>
          Change any subset of the editable fields. Only the fields you send are
          changed.
        </Endpoint>
        <Fields
          rows={[
            { name: "name", type: "string | null", description: "New display name." },
            { name: "description", type: "string | null", description: "New description." },
            { name: "tags", type: "string | null", description: "Comma-separated tags, replacing the old set." },
            { name: "status", type: "string | null", description: <><C>active</C> or <C>revoked</C>.</> },
          ]}
        />
        <CodeTabs
          sample={{
            python: `session.patch("/agents/ag_9f3c1d2e4a", json={
    "description": "Answers tier-1 tickets",
})`,
            js: `await fetch("${API_BASE_URL}${API_PREFIX}/agents/ag_9f3c1d2e4a", {
  method: "PATCH",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ description: "Answers tier-1 tickets" }),
});`,
            curl: `curl -s -b cookies.txt -X PATCH \\
  ${API_BASE_URL}${API_PREFIX}/agents/ag_9f3c1d2e4a \\
  -H "Content-Type: application/json" \\
  -d '{"description":"Answers tier-1 tickets"}'`,
          }}
        />
      </Section>

      <Section title="Rotate a token">
        <Endpoint method="POST" path={`${API_PREFIX}/agents/{agent_id}/rotate`}>
          Generate a new gateway token and re-activate the agent. The new raw
          token is returned once; the old one stops working immediately.
        </Endpoint>
        <ResponseBlock
          json={`{
  "agent": ${AGENT},
  "api_key": "vk_0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d"
}`}
        />
      </Section>

      <Section title="Revoke a token">
        <Endpoint method="POST" path={`${API_PREFIX}/agents/{agent_id}/revoke`}>
          Immediately mark the token unusable. Returns <C>409</C> if it is
          already revoked.
        </Endpoint>
        <ResponseBlock json={AGENT} />
      </Section>

      <Section title="Delete an agent">
        <Endpoint method="DELETE" path={`${API_PREFIX}/agents/{agent_id}`}>
          Permanently remove the agent. Returns <C>204</C> with no body.
        </Endpoint>
      </Section>

      <Section title="Budgets">
        <P>
          A budget caps what an agent may spend, in dollars and/or tokens. A
          call that would exceed the limit is rejected with <C>429</C> before
          the job is queued.
        </P>
        <Endpoint method="GET" path={`${API_PREFIX}/agents/{agent_id}/budget`}>
          The current budget configuration and live usage.
        </Endpoint>
        <Endpoint method="PATCH" path={`${API_PREFIX}/agents/{agent_id}/budget`}>
          Set or clear the limits. Send <C>clear: true</C> to remove them all.
        </Endpoint>
        <Fields
          rows={[
            { name: "budget_usd", type: "number | null", description: "Dollar cap for the period." },
            { name: "budget_tokens", type: "integer | null", description: "Token cap for the period." },
            { name: "budget_reset_at", type: "string | null", description: "ISO-8601 time the usage window resets." },
            { name: "clear", type: "boolean", description: "When true, removes all limits." },
          ]}
        />
        <ResponseBlock
          json={`{
  "budget_usd": 50.0,
  "budget_tokens": 2000000,
  "budget_reset_at": null,
  "spent_usd": 3.41,
  "spent_tokens": 402110,
  "remaining_usd": 46.59,
  "remaining_tokens": 1597890
}`}
        />
      </Section>
    </>
  );
}
