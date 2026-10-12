import { C, Callout, DocHeader, Fields, P, Section } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";

export const metadata = { title: "Python SDK" };

/**
 * The official Python client for the gateway. Everything on this page is
 * installable from the SDK repo; the raw HTTP API it wraps is documented on
 * the Chat completions page.
 */

const SDK_REPO = "https://github.com/G-Tools-Spaces/Vizhi-PythonSDK";

export default function SdkPage() {
  return (
    <>
      <DocHeader eyebrow="Getting started" title="Python SDK">
        The official dependency-free Python client for the Vizhi gateway. It
        wraps <C>POST /v1/chat/completions</C> — model tokens, agent tokens,
        streaming, budgets, and fallback metadata — so consuming products
        never hand-write HTTP.
      </DocHeader>

      <Section title="Install">
        <CodeTabs
          sample={{
            curl: `# latest from main
pip install git+${SDK_REPO}.git

# or pin a release tag for reproducible builds
pip install git+${SDK_REPO}.git@v1.1.0`,
          }}
          caption="Python 3.10+. No third-party dependencies — stdlib only."
        />
        <P>
          Verify the installation:
        </P>
        <CodeTabs
          sample={{
            curl: `python3 -c "import vizhi_sdk; print(vizhi_sdk.__version__)"
# 1.1.0`,
          }}
        />
      </Section>

      <Section title="Quick start">
        <CodeTabs
          sample={{
            python: `import vizhi_sdk as vs

provider = vs.provide_model("vz_live_your_api_token")

answer = provider.chat("Explain Vizhi in one sentence.")

print(answer.content)        # the generated text
print(answer.total_tokens)   # usage
print(answer.latency_ms)     # provider latency
print(answer.query_id)       # trace it in the console`,
          }}
        />
        <P>
          The token is sent as <C>Authorization: Bearer …</C>. The backend
          reads the model bound to the token and routes the request — you never
          name a provider. Point the SDK at a different backend with{" "}
          <C>base_url</C> or the <C>VIZHI_BASE_URL</C> environment variable.
        </P>
      </Section>

      <Section title="Streaming">
        <P>
          <C>chat_stream()</C> yields text deltas as they arrive, then one
          final <C>ChatAnswer</C> with the assembled content and usage
          metadata (read from the <C>vizhi_metadata</C> event the gateway
          emits before <C>[DONE]</C>):
        </P>
        <CodeTabs
          sample={{
            python: `for chunk in provider.chat_stream("Write a haiku about gateways."):
    if isinstance(chunk, vs.ChatAnswer):
        print(f"\\n[done] tokens={chunk.total_tokens} latency={chunk.latency_ms}ms")
    else:
        print(chunk, end="", flush=True)`,
          }}
          caption="Streaming works on model tokens only — agent tokens are queued and answered in one piece."
        />
      </Section>

      <Section title="Agent-bound requests">
        <CodeTabs
          sample={{
            python: `provider = vs.provide_agent_model(
    agent_cid="ag_1234567890",
    agent_token="vz_live_...",
    model_name="llama3.1",
)

answer = provider.chat("Write a short summary.")`,
          }}
          caption="Sends X-Agent-CID / X-Agent-Token; the job is queued for that agent only."
        />
      </Section>

      <Section title="The ChatAnswer object">
        <Fields
          rows={[
            { name: "content", type: "string", description: "The generated text." },
            { name: "input_tokens / output_tokens / total_tokens", type: "integer", description: "Token usage reported by the provider." },
            { name: "latency_ms", type: "integer", description: "End-to-end provider latency." },
            { name: "model / provider", type: "string", description: "What actually served the completion." },
            { name: "query_id", type: "string", description: "The recorded query — look it up in the console." },
            { name: "agent_id", type: "string", description: "The token principal that made the call." },
            { name: "response_id / finish_reason", type: "string", description: "Completion id and stop reason." },
            { name: "used_fallback", type: "boolean", description: "True when a fallback provider served the call." },
            { name: "fallback_attempts", type: "tuple", description: "Providers tried before the one that succeeded." },
            { name: "original_provider", type: "string | null", description: "The provider first attempted, when fallback kicked in." },
            { name: "raw", type: "object", description: "The complete backend response." },
          ]}
        />
        <P>
          Compatibility aliases <C>answer</C>, <C>token</C>,{" "}
          <C>token_queried</C>, and <C>time_taken</C> are kept for older
          integrations.
        </P>
      </Section>

      <Section title="Error handling">
        <CodeTabs
          sample={{
            python: `try:
    answer = provider.chat("Hello")
except vs.BudgetExceededError as exc:
    # 429 — the token is over its budget; no provider call was made.
    print(exc.scope, exc.budget_type, exc.limit_usd or exc.limit_tokens)
except vs.AuthenticationError as exc:
    print(f"Token rejected: {exc}")
except vs.APIError as exc:
    print(f"Request failed: {exc} (HTTP {exc.status_code})")`,
          }}
        />
        <Fields
          title="BudgetExceededError"
          rows={[
            { name: "scope", type: "string", description: '"agent" or "model_token" — which principal ran out.' },
            { name: "budget_type", type: "string", description: '"cost" or "tokens" — which limit was hit.' },
            { name: "limit_usd / spent_usd", type: "float | null", description: "USD limit and spend, for cost budgets." },
            { name: "limit_tokens / spent_tokens", type: "int | null", description: "Token limit and spend, for token budgets." },
          ]}
        />
        <Callout title="Budgets are checked before the provider call">
          A rejected request never spends tokens. <C>BudgetExceededError</C>{" "}
          subclasses <C>APIError</C>, so existing handlers keep working — catch
          it first to degrade gracefully (switch model, notify, pause).
        </Callout>
      </Section>

      <Section title="Where the SDK lives">
        <P>
          Source, tests, and release tags:{" "}
          <a href={SDK_REPO} className="text-accent hover:underline">
            {SDK_REPO.replace("https://", "")}
          </a>
          . The version lives in one place — <C>SDK_VERSION</C> in{" "}
          <C>vizhi_sdk/_defaults.py</C> — and drives{" "}
          <C>__version__</C>, the <C>User-Agent</C> header, and the package
          metadata. Every release is tagged (<C>v1.1.0</C>, …) so clients pin
          exactly what they tested.
        </P>
      </Section>
    </>
  );
}
