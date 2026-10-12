import { C, Callout, DocHeader, P, Section } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";

export const metadata = { title: "Errors" };

const CODES = [
  {
    status: 400,
    when: "The request was malformed: a model that does not match the token's binding, an unresolvable model id, or a missing required field.",
  },
  {
    status: 401,
    when: "No credential, a malformed one, or one that has been revoked or has expired.",
  },
  {
    status: 404,
    when: "The resource does not exist — or exists outside what this credential can see. The two are deliberately indistinguishable.",
  },
  {
    status: 409,
    when: "A state conflict: rotating or revoking a token that is already revoked.",
  },
  {
    status: 422,
    when: "The body parsed but a value failed validation — a field out of range or of the wrong type.",
  },
  {
    status: 429,
    when: "Budget exceeded. The token is over its spending limit; no provider call was made.",
  },
  {
    status: 502,
    when: "Every provider in the fallback chain failed, or an agent job failed.",
  },
  {
    status: 504,
    when: "An agent job did not complete within the gateway's wait window.",
  },
];

export default function ErrorsPage() {
  return (
    <>
      <DocHeader eyebrow="Reference" title="Errors">
        Every failure has the same shape, whatever raised it, so one handler in
        your client covers all of them.
      </DocHeader>

      <Section title="The response shape">
        <ResponseBlock
          status={404}
          json={`{
  "detail": "Model connection not found"
}`}
        />
        <P>
          FastAPI returns a <C>detail</C> field: a sentence written to be shown
          to whoever triggered the call. Validation failures (<C>422</C>)
          instead return a list of field errors under <C>detail</C>.
        </P>
      </Section>

      <Section title="Status codes">
        <div className="my-4 overflow-hidden rounded-lg border border-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                  Status
                </th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {CODES.map((row) => (
                <tr key={row.status} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5 align-top font-mono text-xs text-ink">
                    {row.status}
                  </td>
                  <td className="px-4 py-2.5 align-top text-ink-secondary">
                    {row.when}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Callout title="404 rather than 403 for scope">
          When a credential asks for a resource belonging to another account,
          Vizhi answers <C>404</C>. A <C>403</C> would confirm the resource
          exists, which is information the caller has not earned.
        </Callout>
      </Section>

      <Section title="Handling them">
        <P>
          Branch on the status. A <C>429</C> means stop and wait — the budget
          resets at <C>budget_reset_at</C>. A <C>502</C> is worth retrying with
          backoff, since fallback may succeed on a later attempt. A{" "}
          <C>400</C> or <C>422</C> means the input is wrong and retrying will
          not help.
        </P>
        <CodeTabs
          sample={{
            python: `import httpx

try:
    resp = client.post("/chat/completions", json=payload)
    resp.raise_for_status()
except httpx.HTTPStatusError as error:
    status = error.response.status_code
    if status == 429:
        # Over budget — wait for the window to reset.
        ...
    elif status == 502:
        # Providers failed — safe to retry with backoff.
        ...
    else:
        detail = error.response.json().get("detail")
        raise RuntimeError(f"{status}: {detail}") from error`,
            js: `const res = await fetch(BASE + "/chat/completions", init);
if (!res.ok) {
  const { detail } = await res.json().catch(() => ({ detail: res.statusText }));
  if (res.status === 429) {
    // Over budget — wait for the window to reset.
  } else if (res.status === 502) {
    // Providers failed — safe to retry with backoff.
  }
  throw new Error(\`\${res.status}: \${detail}\`);
}
return res.json();`,
          }}
          caption="Branch on the status; `detail` is for humans."
        />
      </Section>

      <Section title="Rate limits">
        <P>
          There are no request-rate limits yet — the only throttle is the
          spending budget, which returns <C>429</C>. Do not build a client that
          assumes unlimited throughput: a retry with backoff on <C>5xx</C> is
          worth having regardless.
        </P>
      </Section>
    </>
  );
}
