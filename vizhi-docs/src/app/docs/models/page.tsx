import { C, Callout, DocHeader, Endpoint, Fields, P, Section } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";
import { API_BASE_URL, API_PREFIX } from "@/lib/config";

export const metadata = { title: "Model tokens" };

const MODEL_CONNECTION = `{
  "id": "mt_1a2b3c4d",
  "provider": "openai",
  "model_name": "openai/gpt-4o-mini",
  "token_name": "Production",
  "status": "active",
  "metadata": null,
  "usage_count": 142,
  "masked_key": "vk_…9f3c",
  "last_used_at": "2026-09-25T06:12:41.000000",
  "created_at": "2026-09-20T17:02:11.000000"
}`;

export default function ModelsPage() {
  return (
    <>
      <DocHeader eyebrow="Core resources" title="Model tokens">
        A model token is a gateway credential bound to one provider model. It is
        what your application uses to call{" "}
        <C>POST /chat/completions</C>, and what budgets and usage are tracked
        against.
      </DocHeader>

      <Callout title="Console session required">
        Model tokens are managed by a signed-in person, not by a gateway token.
        Creating, listing, rotating and budgeting all need the console session
        cookie — a <C>vk_</C> token cannot manage credentials.
      </Callout>

      <Section title="Create a model token">
        <Endpoint method="POST" path={`${API_PREFIX}/models`}>
          Connect a provider model and mint its gateway token. The raw token is
          returned once, here, and never again.
        </Endpoint>
        <Fields
          rows={[
            {
              name: "provider",
              type: "string",
              required: true,
              description: (
                <>
                  The provider id: <C>openai</C>, <C>claude</C>, <C>gemini</C>,{" "}
                  <C>qwen</C>, <C>huggingface</C>, and the legacy aliases.
                </>
              ),
            },
            {
              name: "model_name",
              type: "string",
              required: true,
              description: (
                <>
                  A model id from the registry, e.g. <C>openai/gpt-4o-mini</C>.
                  Must belong to the chosen provider.
                </>
              ),
            },
            { name: "token_name", type: "string | null", description: "A friendly label for this token." },
            { name: "metadata", type: "string | null", description: "Arbitrary note stored on the connection." },
          ]}
        />
        <CodeTabs
          sample={{
            python: `token = session.post("/models", json={
    "provider": "openai",
    "model_name": "openai/gpt-4o-mini",
    "token_name": "Production",
}).json()

# Store token["api_key"] now — it is never shown again.`,
            js: `const token = await fetch("${API_BASE_URL}${API_PREFIX}/models", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    provider: "openai",
    model_name: "openai/gpt-4o-mini",
    token_name: "Production",
  }),
}).then((r) => r.json());

// Store token.api_key now — it is never shown again.`,
            curl: `curl -s -b cookies.txt -X POST ${API_BASE_URL}${API_PREFIX}/models \\
  -H "Content-Type: application/json" \\
  -d '{"provider":"openai","model_name":"openai/gpt-4o-mini","token_name":"Production"}'`,
          }}
        />
        <ResponseBlock
          status={201}
          json={`{
  "model_connection": ${MODEL_CONNECTION},
  "api_key": "vk_9f3c1d2e4a5b6c7d8e9f0a1b2c3d4e5f"
}`}
        />
      </Section>

      <Section title="List model tokens">
        <Endpoint method="GET" path={`${API_PREFIX}/models`}>
          Every model token the caller owns, newest first.
        </Endpoint>
        <CodeTabs
          sample={{
            python: `session.get("/models").json()`,
            js: `await fetch("${API_BASE_URL}${API_PREFIX}/models", {
  credentials: "include",
}).then((r) => r.json());`,
            curl: `curl -s -b cookies.txt ${API_BASE_URL}${API_PREFIX}/models`,
          }}
        />
        <ResponseBlock json={`[
  ${MODEL_CONNECTION}
]`} />
      </Section>

      <Section title="List the model registry">
        <Endpoint method="GET" path={`${API_PREFIX}/models/registry`}>
          The provider/model catalogue for client dropdowns — every provider and
          the models that can be connected. No authentication required.
        </Endpoint>
        <ResponseBlock
          json={`[
  {
    "id": "openai",
    "label": "OpenAI",
    "models": [
      { "id": "openai/gpt-4o", "label": "gpt-4o" },
      { "id": "openai/gpt-4o-mini", "label": "gpt-4o-mini" }
    ]
  }
]`}
        />
      </Section>

      <Section title="Get usage for a model token">
        <Endpoint method="GET" path={`${API_PREFIX}/models/{model_id}/usage`}>
          Aggregate statistics plus recent query/response pairs for one token.
        </Endpoint>
        <Fields
          title="Query parameters"
          rows={[
            { name: "limit", type: "integer", description: "How many recent queries to return. Defaults to 50." },
          ]}
        />
        <ResponseBlock
          json={`{
  "model_connection": ${MODEL_CONNECTION},
  "stats": {
    "total_requests": 142,
    "total_input_tokens": 90210,
    "total_output_tokens": 21044,
    "total_tokens": 111254,
    "total_cost": 0.1831,
    "avg_latency_ms": 402,
    "error_count": 1,
    "success_rate": 99.3
  },
  "recent_queries": [
    {
      "query_id": "q_7c8d9e0f1a2b",
      "timestamp": "2026-09-25T06:12:41.000000",
      "agent_id": "mt_1a2b3c4d",
      "prompt": [{ "role": "user", "content": "Say hello." }],
      "response_text": "Hello!",
      "input_tokens": 12,
      "output_tokens": 2,
      "latency_ms": 388,
      "status_code": 200,
      "estimated_cost": 0.000012,
      "error_message": null
    }
  ]
}`}
        />
      </Section>

      <Section title="Rotate a token">
        <Endpoint method="POST" path={`${API_PREFIX}/models/{model_id}/rotate`}>
          Generate a new gateway token and re-activate the connection. The new
          raw token is returned once; the old one stops working immediately.
        </Endpoint>
        <ResponseBlock
          json={`{
  "model_connection": ${MODEL_CONNECTION},
  "api_key": "vk_0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d"
}`}
        />
      </Section>

      <Section title="Revoke a token">
        <Endpoint method="POST" path={`${API_PREFIX}/models/{model_id}/revoke`}>
          Immediately mark the token unusable. Returns <C>409</C> if it is
          already revoked.
        </Endpoint>
        <ResponseBlock json={MODEL_CONNECTION} />
      </Section>

      <Section title="Delete a model token">
        <Endpoint method="DELETE" path={`${API_PREFIX}/models/{model_id}`}>
          Permanently remove the connection. Returns <C>204</C> with no body.
        </Endpoint>
      </Section>

      <Section title="Budgets">
        <P>
          A budget caps what a token may spend, in dollars and/or tokens. A call
          that would exceed the limit is rejected with <C>429</C> before any
          provider call is made.
        </P>
        <Endpoint method="GET" path={`${API_PREFIX}/models/{model_id}/budget`}>
          The current budget configuration and live usage.
        </Endpoint>
        <Endpoint method="PATCH" path={`${API_PREFIX}/models/{model_id}/budget`}>
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
        <CodeTabs
          sample={{
            python: `session.patch("/models/mt_1a2b3c4d/budget", json={
    "budget_usd": 25.0,
    "budget_tokens": 1_000_000,
})`,
            js: `await fetch("${API_BASE_URL}${API_PREFIX}/models/mt_1a2b3c4d/budget", {
  method: "PATCH",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ budget_usd: 25.0, budget_tokens: 1_000_000 }),
});`,
            curl: `curl -s -b cookies.txt -X PATCH \\
  ${API_BASE_URL}${API_PREFIX}/models/mt_1a2b3c4d/budget \\
  -H "Content-Type: application/json" \\
  -d '{"budget_usd":25.0,"budget_tokens":1000000}'`,
          }}
        />
        <ResponseBlock
          json={`{
  "budget_usd": 25.0,
  "budget_tokens": 1000000,
  "budget_reset_at": null,
  "spent_usd": 0.1831,
  "spent_tokens": 111254,
  "remaining_usd": 24.8169,
  "remaining_tokens": 888746
}`}
        />
      </Section>
    </>
  );
}
