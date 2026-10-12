import { C, Callout, DocHeader, Endpoint, Fields, P, Section } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";
import { API_BASE_URL } from "@/lib/config";

export const metadata = { title: "Agent queue" };

export default function AgentQueuePage() {
  return (
    <>
      <DocHeader eyebrow="Core resources" title="Agent queue">
        The queue is how an on-site agent receives work. When a call arrives on
        an agent token, Vizhi queues a job; your agent process claims it over a
        websocket or by polling, runs it, and submits the result.
      </DocHeader>

      <Callout title="A different credential, and no /v1 prefix">
        These endpoints are for the agent process itself, not the console. They
        authenticate with two headers — <C>x-agent-cid</C> and{" "}
        <C>x-agent-token</C> — and they live at the API root, not under{" "}
        <C>/v1</C>.
      </Callout>

      <Section title="Connect the websocket">
        <Endpoint method="WS" path="/ws/agent">
          The realtime channel. On connect Vizhi sends{" "}
          <C>{`{"type":"connected"}`}</C>; when a job is queued for this agent it
          pushes a <C>job_available</C> message. Send <C>ping</C> to receive a{" "}
          <C>pong</C>.
        </Endpoint>
        <Fields
          title="Headers"
          rows={[
            { name: "x-agent-cid", type: "string", required: true, description: <>The agent CID, <C>ag_…</C>.</> },
            { name: "x-agent-token", type: "string", required: true, description: "The agent's gateway token." },
          ]}
        />
        <CodeTabs
          sample={{
            python: `import asyncio, json, websockets

async def run():
    async with websockets.connect(
        "${API_BASE_URL.replace("http", "ws")}/ws/agent",
        additional_headers={
            "x-agent-cid": AGENT_CID,
            "x-agent-token": AGENT_TOKEN,
        },
    ) as ws:
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("type") == "job_available":
                handle_job(msg)  # then POST /jobs/submit

asyncio.run(run())`,
            js: `const ws = new WebSocket("${API_BASE_URL.replace("http", "ws")}/ws/agent", {
  headers: {
    "x-agent-cid": AGENT_CID,
    "x-agent-token": AGENT_TOKEN,
  },
});

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "job_available") handleJob(msg); // then POST /jobs/submit
};`,
          }}
          caption="The websocket is the fast path — the agent is notified the moment a job is queued, before it would next poll."
        />
      </Section>

      <Section title="Register the agent">
        <Endpoint method="POST" path="/agents/register">
          Announce the agent as online and describe the machine it runs on.
          Called once at startup.
        </Endpoint>
        <Fields
          rows={[
            { name: "agent_id", type: "string", required: true, description: "Must match the authenticated agent." },
            { name: "device_name", type: "string", description: "Host or device label." },
            { name: "os_name", type: "string", description: "Operating system." },
            { name: "agent_version", type: "string", description: "Your agent software version." },
            { name: "available_engines", type: "array", description: "Engines this agent can run." },
          ]}
        />
        <CodeTabs
          sample={{
            python: `import httpx

queue = httpx.Client(
    base_url="${API_BASE_URL}",
    headers={"x-agent-cid": AGENT_CID, "x-agent-token": AGENT_TOKEN},
)

queue.post("/agents/register", json={
    "agent_id": AGENT_CID,
    "device_name": "worker-01",
    "os_name": "linux",
    "agent_version": "1.0.0",
    "available_engines": ["openai", "anthropic"],
})`,
            js: `await fetch("${API_BASE_URL}/agents/register", {
  method: "POST",
  headers: {
    "x-agent-cid": AGENT_CID,
    "x-agent-token": AGENT_TOKEN,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    agent_id: AGENT_CID,
    device_name: "worker-01",
    os_name: "linux",
    agent_version: "1.0.0",
    available_engines: ["openai", "anthropic"],
  }),
});`,
            curl: `curl -s -X POST ${API_BASE_URL}/agents/register \\
  -H "x-agent-cid: $AGENT_CID" \\
  -H "x-agent-token: $AGENT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"agent_id":"'$AGENT_CID'","device_name":"worker-01","os_name":"linux","agent_version":"1.0.0","available_engines":["openai"]}'`,
          }}
        />
        <ResponseBlock
          json={`{
  "agent_id": "ag_9f3c1d2e4a",
  "device_name": "worker-01",
  "os_name": "linux",
  "agent_version": "1.0.0",
  "status": "online",
  "last_heartbeat": "2026-09-25T06:12:41.000000",
  "available_engines": ["openai", "anthropic"],
  "updated_at": "2026-09-25T06:12:41.000000"
}`}
        />
      </Section>

      <Section title="Send a heartbeat">
        <Endpoint method="POST" path="/agents/heartbeat">
          Keep the agent marked online and report its current load. Same body as
          register, plus optional status fields.
        </Endpoint>
        <Fields
          rows={[
            { name: "agent_id", type: "string", required: true, description: "Must match the authenticated agent." },
            { name: "status", type: "string", description: <><C>online</C>, <C>busy</C>, etc. Defaults to <C>online</C>.</> },
            { name: "active_job_id", type: "string", description: "The job currently being processed, if any." },
            { name: "active_engine", type: "string", description: "The engine in use, if any." },
            { name: "queue_depth", type: "integer", description: "Locally queued jobs. Defaults to 0." },
          ]}
        />
      </Section>

      <Section title="Claim the next job">
        <Endpoint method="GET" path="/jobs/next">
          Atomically claim the oldest queued job for this agent. Returns{" "}
          <C>204</C> when the queue is empty. This is the polling fallback for
          agents not on the websocket.
        </Endpoint>
        <ResponseBlock
          json={`{
  "id": "j_7c8d9e0f1a2b",
  "query_id": "q_7c8d9e0f1a2b",
  "agent_id": "ag_9f3c1d2e4a",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "sdk_type": "openai-sdk",
  "endpoint": "/v1/chat/completions",
  "kind": "chat",
  "engine": "",
  "input": { "messages": [{ "role": "user", "content": "Say hello." }] },
  "stream": false,
  "metadata": { "source": "chat-gateway" },
  "attempt_count": 1
}`}
        />
      </Section>

      <Section title="Submit a result">
        <Endpoint method="POST" path="/jobs/submit">
          Report a job as completed or failed. The gateway, which has been
          waiting on the original <C>POST /chat/completions</C> call, now returns
          this result to the caller.
        </Endpoint>
        <Fields
          rows={[
            { name: "job_id", type: "string", required: true, description: "The job being completed." },
            { name: "status", type: "string", description: <><C>completed</C> or <C>failed</C>.</> },
            { name: "output", type: "object", description: "The completion payload (OpenAI-shaped)." },
            { name: "error", type: "string", description: "Error message when status is failed." },
            { name: "usage", type: "object", description: "Token usage figures." },
            { name: "completed_at", type: "string", description: "ISO-8601 completion time." },
          ]}
        />
        <CodeTabs
          sample={{
            python: `queue.post("/jobs/submit", json={
    "job_id": job["id"],
    "status": "completed",
    "output": {
        "model": job["model"],
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": answer},
            "finish_reason": "stop",
        }],
        "usage": {"prompt_tokens": 12, "completion_tokens": 9},
    },
})`,
            js: `await fetch("${API_BASE_URL}/jobs/submit", {
  method: "POST",
  headers: {
    "x-agent-cid": AGENT_CID,
    "x-agent-token": AGENT_TOKEN,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    job_id: job.id,
    status: "completed",
    output: {
      model: job.model,
      choices: [{
        index: 0,
        message: { role: "assistant", content: answer },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: 12, completion_tokens: 9 },
    },
  }),
});`,
            curl: `curl -s -X POST ${API_BASE_URL}/jobs/submit \\
  -H "x-agent-cid: $AGENT_CID" \\
  -H "x-agent-token: $AGENT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"job_id":"'$JOB_ID'","status":"completed","output":{"choices":[{"index":0,"message":{"role":"assistant","content":"Hello"},"finish_reason":"stop"}]}}'`,
          }}
        />
        <ResponseBlock
          json={`{
  "ok": true,
  "job_id": "j_7c8d9e0f1a2b",
  "status": "completed",
  "query_id": "q_7c8d9e0f1a2b",
  "completed_at": "2026-09-25T06:12:45.000000"
}`}
        />
      </Section>
    </>
  );
}
