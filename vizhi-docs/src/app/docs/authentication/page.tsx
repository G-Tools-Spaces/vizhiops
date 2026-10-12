import Link from "next/link";

import { C, Callout, DocHeader, Endpoint, Fields, P, Section, Ul } from "@/components/docs";
import { CodeTabs, ResponseBlock } from "@/components/CodeTabs";
import { API_BASE_URL, API_PREFIX, CONSOLE_URL } from "@/lib/config";

export const metadata = { title: "Authentication" };

export default function AuthenticationPage() {
  return (
    <>
      <DocHeader eyebrow="Getting started" title="Authentication">
        Vizhi authenticates two kinds of caller and keeps them strictly apart.
        Which one you are determines not just whether a request is allowed, but
        how much of the database it can see.
      </DocHeader>

      <Section title="Gateway tokens">
        <P>
          A gateway token is a bearer credential issued to one model token or
          one agent. Send it on every gateway request:
        </P>
        <CodeTabs
          sample={{
            python: `headers = {"Authorization": f"Bearer {os.environ['VIZHI_TOKEN']}"}`,
            js: `const headers = { Authorization: \`Bearer \${process.env.VIZHI_TOKEN}\` };`,
            curl: `-H "Authorization: Bearer $VIZHI_TOKEN"`,
          }}
        />
        <P>
          Every token begins with <C>vk_</C>. That prefix is not decoration: it
          is how Vizhi tells a machine credential from a session, so a leaked
          gateway token can never be replayed as a browser session, and vice
          versa.
        </P>
        <Callout title="A token sees only what it is bound to">
          A model token is bound to one provider model; an agent token to one
          agent. The binding is read from the credential row, never from the
          request — asking for a different model than the token's own gets{" "}
          <C>400</C>, and asking for another account's resource gets{" "}
          <C>404</C>.
        </Callout>
      </Section>

      <Section title="Console sessions">
        <P>
          A signed-in person carries an HttpOnly session cookie and reaches
          every agent, model token and query they own. This is what{" "}
          <a href={CONSOLE_URL} className="text-accent hover:underline">
            the console
          </a>{" "}
          uses, and what creating credentials requires — a gateway token cannot
          mint another credential.
        </P>

        <Endpoint method="POST" path={`${API_PREFIX}/auth/signup`}>
          Create an account with email and password. Returns the user and sets
          the session cookie.
        </Endpoint>
        <Fields
          rows={[
            { name: "email", type: "string", required: true, description: "3–254 characters." },
            { name: "password", type: "string", required: true, description: "8–128 characters." },
            { name: "name", type: "string", description: "Display name, up to 120 characters." },
          ]}
        />

        <Endpoint method="POST" path={`${API_PREFIX}/auth/login`}>
          Exchange email and password for a session cookie.
        </Endpoint>
        <Fields
          rows={[
            { name: "email", type: "string", required: true, description: "The account email." },
            { name: "password", type: "string", required: true, description: "The account password." },
          ]}
        />
        <CodeTabs
          sample={{
            python: `import httpx

session = httpx.Client(base_url="${API_BASE_URL}${API_PREFIX}")
session.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
# The session cookie is now stored on the client and sent automatically.`,
            js: `// \`credentials: "include"\` is what stores the cookie the login sets.
await fetch("${API_BASE_URL}${API_PREFIX}/auth/login", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});`,
            curl: `curl -s -c cookies.txt -X POST ${API_BASE_URL}${API_PREFIX}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com","password":"••••••••"}'`,
          }}
        />
        <ResponseBlock
          json={`{
  "user": {
    "id": "u_9f3c1d2e",
    "email": "you@example.com",
    "email_verified": false,
    "name": "You",
    "avatar_url": ""
  }
}`}
        />

        <Endpoint method="POST" path={`${API_PREFIX}/auth/google`}>
          Sign in with a Google ID token instead of a password.
        </Endpoint>
        <Fields
          rows={[
            { name: "id_token", type: "string", required: true, description: "A verified Google ID token." },
          ]}
        />

        <Endpoint method="GET" path={`${API_PREFIX}/auth/me`}>
          Return the current user, or <C>401</C> if there is no valid session.
        </Endpoint>

        <Endpoint method="POST" path={`${API_PREFIX}/auth/logout`}>
          Clear the session cookie. Returns <C>204</C> with no body.
        </Endpoint>
      </Section>

      <Section title="When authentication fails">
        <P>
          A missing, malformed, revoked or expired credential gets <C>401</C>.
          A valid credential asking for something outside its scope gets{" "}
          <C>404</C>, not <C>403</C> — Vizhi does not confirm that a resource
          exists to a caller that cannot see it. See{" "}
          <Link href="/docs/errors" className="text-accent hover:underline">
            Errors
          </Link>
          .
        </P>
      </Section>

      <Section title="Handling a lost token">
        <P>
          Tokens are stored as hashes, so no endpoint can return one after
          creation. Rotate the credential —{" "}
          <C>POST /models/{"{id}"}/rotate</C> or{" "}
          <C>POST /agents/{"{id}"}/rotate</C> — and store the replacement.
          Rotation takes effect immediately; there is no cache to wait out. See{" "}
          <Link href="/docs/models" className="text-accent hover:underline">
            Model tokens
          </Link>{" "}
          and{" "}
          <Link href="/docs/agents" className="text-accent hover:underline">
            Agents
          </Link>
          .
        </P>
      </Section>
    </>
  );
}
