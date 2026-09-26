import { C, Callout, DocHeader, Endpoint, Fields, P, Section } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";
import { TryIt } from "@/components/TryIt";
import { API_BASE_URL, API_PREFIX } from "@/lib/config";

export const metadata = { title: "Chat completions" };

export default function ChatPage() {
  return (
    <>
      <DocHeader eyebrow="Core resources" title="Chat completions">
        The one endpoint day-to-day traffic goes through. It is
        OpenAI-compatible, routes to the provider your token is bound to, and
        records the query before returning.
      </DocHeader>

      <Section title="Create a chat completion">
        <Endpoint method="POST" path={`${API_PREFIX}/chat/completions`}>
          Send a conversation, get a completion. Behaviour depends on the token:
          a <strong className="font-medium text-ink">model token</strong> calls
          the provider directly (with optional streaming and automatic
          fallback); an <strong className="font-medium text-ink">agent
          token</strong> queues the job for your on-site agent and waits for the
          result.
        </Endpoint>

        <Fields
          rows={[
            {
              name: "model",
              type: "string | null",
              description: (
                <>
                  The model id, e.g. <C>openai/gpt-4o-mini</C>. Optional for a
                  model token (it is already bound to one); required for an
                  agent token. If provided, it must match the token's model.
                </>
              ),
            },
            {
              name: "messages",
              type: "array",
              required: true,
              description: (
                <>
                  The conversation, as <C>{`{role, content}`}</C> objects. Roles
                  are <C>system</C>, <C>user</C>, <C>assistant</C>.
                </>
              ),
            },
            {
              name: "call_sdk",
              type: "string | null",
              description: (
                <>
                  SDK adapter hint: <C>openai-sdk</C>, <C>claude-sdk</C>,{" "}
                  <C>raw-http</C>.
                </>
              ),
            },
            {
              name: "temperature",
              type: "number",
              description: <>Sampling temperature, 0.0–2.0. Defaults to 1.0.</>,
            },
            {
              name: "max_tokens",
              type: "integer | null",
              description: "Upper bound on completion tokens, 1–128000.",
            },
            {
              name: "stream",
              type: "boolean",
              description: (
                <>
                  When true (model tokens only), the response streams as
                  Server-Sent Events: OpenAI-compatible <C>data: {`{...}`}</C>{" "}
                  lines terminated by <C>data: [DONE]</C>.
                </>
              ),
            },
          ]}
        />

        <CodeTabs
          sample={{
            python: `import os
import httpx

client = httpx.Client(
    base_url="${API_BASE_URL}${API_PREFIX}",
    headers={"Authorization": f"Bearer {os.environ['VIZHI_TOKEN']}"},
)

resp = client.post(
    "/chat/completions",
    json={
        "model": "openai/gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are terse."},
            {"role": "user", "content": "Explain DNS in one sentence."},
        ],
        "temperature": 0.2,
        "max_tokens": 64,
    },
).json()

print(resp["choices"][0]["message"]["content"])`,
            js: `const resp = await fetch("${API_BASE_URL}${API_PREFIX}/chat/completions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.VIZHI_TOKEN}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: "You are terse." },
      { role: "user", content: "Explain DNS in one sentence." },
    ],
    temperature: 0.2,
    max_tokens: 64,
  }),
}).then((r) => r.json());

console.log(resp.choices[0].message.content);`,
            curl: `curl -s -X POST ${API_BASE_URL}${API_PREFIX}/chat/completions \\
  -H "Authorization: Bearer $VIZHI_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Explain DNS in one sentence."}],
    "temperature": 0.2,
    "max_tokens": 64
  }'`,
          }}
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
      "message": {
        "role": "assistant",
        "content": "DNS maps human-readable names to IP addresses."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 24, "completion_tokens": 9, "total_tokens": 33 },
  "vizhi_metadata": {
    "agent_id": "mt_1a2b3c4d",
    "provider": "openai",
    "latency_ms": 388,
    "query_id": "q_7c8d9e0f1a2b",
    "used_fallback": false,
    "fallback_attempts": [],
    "original_provider": null
  }
}`}
        />

        <TryIt
          method="POST"
          path={`${API_PREFIX}/chat/completions`}
          body={`{
  "model": "openai/gpt-4o-mini",
  "messages": [
    { "role": "user", "content": "Explain DNS in one sentence." }
  ],
  "temperature": 0.2,
  "max_tokens": 64
}`}
        />
      </Section>

      <Section title="The vizhi_metadata block">
        <P>
          Every response carries a <C>vizhi_metadata</C> object alongside the
          OpenAI-compatible fields. It is how you trace a completion back into
          Vizhi.
        </P>
        <Fields
          title="vizhi_metadata"
          rows={[
            { name: "agent_id", type: "string", description: "The token (model token or agent) that made the call." },
            { name: "provider", type: "string", description: "The provider that actually served the completion." },
            { name: "latency_ms", type: "integer", description: "End-to-end latency of the provider call." },
            { name: "query_id", type: "string", description: <>The recorded query. Look it up under <C>GET /queries/{"{id}"}</C>.</> },
            { name: "used_fallback", type: "boolean", description: "True when automatic provider fallback served the call." },
            { name: "fallback_attempts", type: "array", description: "Providers tried before the one that succeeded." },
            { name: "original_provider", type: "string | null", description: "The provider first attempted, when fallback kicked in." },
          ]}
        />
      </Section>

      <Section title="Streaming">
        <P>
          Set <C>stream: true</C> on a model token and the response is a
          Server-Sent Events stream. Each chunk is an OpenAI-compatible delta;
          the stream ends with <C>data: [DONE]</C>. The query id is returned in
          the <C>X-Vizhi-Query-Id</C> response header.
        </P>
        <CodeTabs
          sample={{
            python: `with client.stream(
    "POST",
    "/chat/completions",
    json={
        "model": "openai/gpt-4o-mini",
        "messages": [{"role": "user", "content": "Count to five."}],
        "stream": True,
    },
) as stream:
    for line in stream.iter_lines():
        if line.startswith("data: "):
            print(line)`,
            js: `const res = await fetch("${API_BASE_URL}${API_PREFIX}/chat/completions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.VIZHI_TOKEN}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: "Count to five." }],
    stream: true,
  }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  process.stdout.write(decoder.decode(value));
}`,
            curl: `curl -N -X POST ${API_BASE_URL}${API_PREFIX}/chat/completions \\
  -H "Authorization: Bearer $VIZHI_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Count to five."}],"stream":true}'`,
          }}
          caption="Streaming is available on model tokens only; agent tokens always return a single buffered response."
        />
      </Section>

      <Section title="Budgets and fallback">
        <P>
          Before any provider call, Vizhi checks the token's budget. A token
          over its limit gets <C>429</C> immediately — no provider call is made.
          If the primary provider fails and fallback is enabled, Vizhi retries
          and then waterfalls through the fallback chain, recording each attempt
          in <C>vizhi_metadata</C>.
        </P>
        <Callout title="Agent tokens never stream">
          An agent token's call is queued and fulfilled by your on-site
          agent, then returned as one buffered response. The gateway waits up to
          900 seconds; on timeout it returns <C>504</C> with the job id. See{" "}
          <a href="/docs/agent-queue" className="text-accent hover:underline">
            Agent queue
          </a>
          .
        </Callout>
      </Section>
    </>
  );
}
