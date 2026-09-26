import Link from "next/link";

import { C, Callout, DocHeader, P, Section, Ul } from "@/components/docs";
import { CodeTabs } from "@/components/CodeTabs";
import { API_BASE_URL, API_PREFIX } from "@/lib/config";

export const metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <>
      <DocHeader eyebrow="Reference" title="Overview">
        Vizhi is a unified API gateway and query-tracking core for AI agents.
        One OpenAI-compatible endpoint routes to every configured provider, and
        every call is metered, budget-checked and traced back to the token that
        made it.
      </DocHeader>

      <Section title="Base URL">
        <P>
          All endpoints live under <C>{API_PREFIX}</C>. Request and response
          bodies are JSON, and timestamps are ISO-8601 in UTC.
        </P>
        <CodeTabs
          sample={{
            python: `BASE = "${API_BASE_URL}${API_PREFIX}"`,
            js: `const BASE = "${API_BASE_URL}${API_PREFIX}";`,
            curl: `${API_BASE_URL}${API_PREFIX}`,
          }}
        />
      </Section>

      <Section title="What Vizhi sits between">
        <P>
          Your application talks to Vizhi; Vizhi talks to the model providers.
          The indirection is the product — it is what makes a single credential
          able to reach many providers, and what lets every request be recorded
          before it ever leaves your infrastructure.
        </P>
        <Ul>
          <li>
            <strong className="font-medium text-ink">Model tokens</strong> — a
            credential bound to one provider model. Calls resolve the provider
            directly and stream or return the answer.
          </li>
          <li>
            <strong className="font-medium text-ink">Agents</strong> — a
            credential for an on-site worker. Calls are queued and fulfilled by
            your own agent process over a websocket.
          </li>
          <li>
            <strong className="font-medium text-ink">Queries</strong> — every
            call, recorded with its tokens, latency, cost and status.
          </li>
          <li>
            <strong className="font-medium text-ink">Metrics & dashboard</strong>{" "}
            — the same queries, aggregated for charts and totals.
          </li>
        </Ul>
      </Section>

      <Section title="Two kinds of caller">
        <P>Vizhi authenticates two things, and they are never interchangeable.</P>
        <Ul>
          <li>
            A <strong className="font-medium text-ink">gateway token</strong> — a
            bearer token prefixed <C>vk_</C>, issued to a model token or an
            agent. This is what calls <C>POST /chat/completions</C>.
          </li>
          <li>
            A <strong className="font-medium text-ink">console session</strong> —
            a signed-in human holding a cookie. This is what creates agents and
            model tokens, and what the observability endpoints read. It is not
            for programmatic gateway traffic.
          </li>
        </Ul>
        <Callout title="Scope is never taken from the request">
          A token that asks for a resource it does not own gets <C>404</C>, not
          that resource's data. Ids in a URL narrow a query; they never
          widen one. See{" "}
          <Link href="/docs/authentication" className="text-accent hover:underline">
            Authentication
          </Link>
          .
        </Callout>
      </Section>

      <Section title="Where to start">
        <P>
          If you are integrating an application, read{" "}
          <Link href="/docs/quickstart" className="text-accent hover:underline">
            Quickstart
          </Link>{" "}
          — it goes from an empty account to a completed chat call in a few
          steps. If you already have a token, go straight to{" "}
          <Link href="/docs/chat" className="text-accent hover:underline">
            Chat completions
          </Link>
          , which is where day-to-day traffic goes.
        </P>
      </Section>
    </>
  );
}
