import Link from "next/link";

import { C, Callout, DocHeader, P, Section } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";
import { API_BASE_URL, API_PREFIX, CONSOLE_URL } from "@/lib/config";

export const metadata = { title: "Quickstart" };

export default function QuickstartPage() {
  return (
    <>
      <DocHeader eyebrow="Getting started" title="Quickstart">
        From an empty account to a completed chat completion. The first two
        steps happen once, in the console; the last is what your application
        does every day.
      </DocHeader>

      <Section title="1. Sign in and connect a model">
        <P>
          Sign in at{" "}
          <a href={CONSOLE_URL} className="text-accent hover:underline">
            the console
          </a>
          , then open <strong className="font-medium text-ink">Connect Model</strong>.
          Pick a provider and model, and Vizhi issues a model token. Connecting
          a model is also an API call — see{" "}
          <Link href="/docs/models" className="text-accent hover:underline">
            Model tokens
          </Link>{" "}
          — but it needs a console session, so the console is the shorter path.
        </P>
      </Section>

      <Section title="2. Copy the gateway token">
        <P>
          The raw token is shown once, on creation, and never again — only a
          hash is stored. Copy it into your application's environment as{" "}
          <C>VIZHI_TOKEN</C>.
        </P>
        <ResponseBlock
          status={201}
          json={`{
  "model_connection": {
    "id": "mt_1a2b3c4d",
    "provider": "openai",
    "model_name": "openai/gpt-4o-mini",
    "status": "active",
    "masked_key": "vk_…9f3c"
  },
  "api_key": "vk_9f3c1d2e…"
}`}
        />
        <Callout tone="warn" title="This is a one-way door">
          If the token is lost, rotate it —{" "}
          <C>POST /models/{"{id}"}/rotate</C> — and store the replacement. There
          is no endpoint that returns the old one, because Vizhi does not have
          it.
        </Callout>
      </Section>

      <Section title="3. Make a chat completion">
        <P>
          <C>POST /chat/completions</C> is OpenAI-compatible. Send the token as
          a bearer and the model the token is bound to; Vizhi routes it to the
          provider and records the query.
        </P>
        <CodeTabs
          sample={{
            python: `import os
import httpx

BASE = "${API_BASE_URL}${API_PREFIX}"
TOKEN = os.environ["VIZHI_TOKEN"]

client = httpx.Client(
    base_url=BASE,
    headers={"Authorization": f"Bearer {TOKEN}"},
)

resp = client.post(
    "/chat/completions",
    json={
        "model": "openai/gpt-4o-mini",
        "messages": [{"role": "user", "content": "Say hello in one word."}],
    },
).json()

print(resp["choices"][0]["message"]["content"])`,
            js: `const BASE = "${API_BASE_URL}${API_PREFIX}";
const TOKEN = process.env.VIZHI_TOKEN;

const resp = await fetch(\`\${BASE}/chat/completions\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${TOKEN}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: "Say hello in one word." }],
  }),
}).then((r) => r.json());

console.log(resp.choices[0].message.content);`,
            curl: `curl -s -X POST ${API_BASE_URL}${API_PREFIX}/chat/completions \\
  -H "Authorization: Bearer $VIZHI_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello in one word."}]
  }'`,
          }}
          caption="The same shape works against any connected provider — only the model id changes."
        />
        <ResponseBlock
          json={`{
  "id": "vzr_9f3c1d2e4a5b",
  "object": "chat.completion",
  "created": 1758700000,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello" },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 12, "completion_tokens": 1, "total_tokens": 13 },
  "vizhi_metadata": {
    "agent_id": "mt_1a2b3c4d",
    "provider": "openai",
    "latency_ms": 412,
    "query_id": "q_7c8d9e0f1a2b",
    "used_fallback": false,
    "fallback_attempts": [],
    "original_provider": null
  }
}`}
        />
        <P>
          That is the whole loop. The call is now visible under{" "}
          <Link href="/docs/queries" className="text-accent hover:underline">
            Queries
          </Link>{" "}
          and aggregated into{" "}
          <Link href="/docs/metrics" className="text-accent hover:underline">
            Metrics
          </Link>{" "}
          and the{" "}
          <Link href="/docs/dashboard" className="text-accent hover:underline">
            Dashboard
          </Link>
          .
        </P>
      </Section>
    </>
  );
}
