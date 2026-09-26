import Link from "next/link";

import { C, DocHeader, Endpoint, Fields, P, Section } from "@/components/docs";
import {
  openApiIndex,
  tagTitle,
  totalEndpoints,
  TAG_META,
  type ApiEndpoint,
} from "@/lib/openapi";

export const metadata = { title: "API reference index" };

/**
 * The complete endpoint list, generated from the backend's OpenAPI spec by
 * `npm run sync`. Where the curated pages (Chat, Models, …) explain how to use
 * the API, this index guarantees that *every* endpoint is listed — including
 * any added to the backend since the curated pages were written.
 */

const METHOD_TONE: Record<string, string> = {
  GET: "border-info/25 bg-info-soft text-info",
  POST: "border-ok/25 bg-ok-soft text-ok",
  PATCH: "border-warn/25 bg-warn-soft text-warn",
  PUT: "border-warn/25 bg-warn-soft text-warn",
  DELETE: "border-danger/25 bg-danger-soft text-danger",
};

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const query = endpoint.parameters.filter((p) => p.in === "query");
  const path = endpoint.parameters.filter((p) => p.in === "path");
  const id = `${endpoint.method}-${endpoint.path}`.replace(/[^a-zA-Z0-9]+/g, "-");

  return (
    <div className="mt-6 first:mt-0">
      <Endpoint
        method={endpoint.method as "GET"}
        path={endpoint.path}
        id={id}
      >
        {endpoint.summary || endpoint.description || undefined}
      </Endpoint>

      {path.length > 0 && (
        <Fields
          title="Path parameters"
          rows={path.map((p) => ({
            name: p.name,
            type: p.type,
            required: p.required,
            description: p.description || "—",
          }))}
        />
      )}
      {query.length > 0 && (
        <Fields
          title="Query parameters"
          rows={query.map((p) => ({
            name: p.name,
            type: p.type,
            required: p.required,
            description: p.description || "—",
          }))}
        />
      )}
      {endpoint.requestBody.length > 0 && (
        <Fields
          rows={endpoint.requestBody.map((f) => ({
            name: f.name,
            type: f.type,
            required: f.required,
            description: f.description || "—",
          }))}
        />
      )}
    </div>
  );
}

export default function ReferencePage() {
  const total = totalEndpoints(openApiIndex);
  const generated = new Date(openApiIndex.generatedAt);

  return (
    <>
      <DocHeader eyebrow="Reference" title="API reference index">
        Every endpoint the backend exposes — {total} of them — generated
        directly from the OpenAPI spec. Run <C>npm run sync</C> after changing
        the backend and this page updates itself.
      </DocHeader>

      <P>
        Last synced {generated.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}{" "}
        at{" "}
        {generated.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        from <C>{openApiIndex.title}</C> <C>v{openApiIndex.version}</C>. For
        narrative guides and copy-paste examples, use the curated pages linked
        from each section.
      </P>

      {openApiIndex.groups.map((group) => {
        const meta = TAG_META[group.tag];
        return (
          <Section key={group.tag} id={group.tag} title={tagTitle(group.tag)}>
            {meta && (
              <P>
                See the{" "}
                <Link href={meta.href} className="text-accent hover:underline">
                  {meta.title} guide
                </Link>{" "}
                for examples.
              </P>
            )}
            {group.endpoints.map((endpoint) => (
              <EndpointCard
                key={`${endpoint.method}-${endpoint.path}`}
                endpoint={endpoint}
              />
            ))}
          </Section>
        );
      })}
    </>
  );
}
