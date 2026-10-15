"use client";

import { Link2, Unlink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, Label } from "@/components/ui/field";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAgents, useCreateLink, useLinks, useModels } from "@/lib/api/queries";
import { formatNumber } from "@/lib/utils";

export default function LinksPage() {
  const { data: agents = [] } = useAgents();
  const { data: models = [] } = useModels();
  const { data: links = [] } = useLinks();
  const createLink = useCreateLink();
  const [agentId, setAgentId] = useState("");
  const [modelId, setModelId] = useState("");

  return (
    <>
      <PageHeader title="Links" description="Bind agents to model tokens for attribution, policy and cost tracking." />
      <div className="grid items-start gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Create link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={agentId} onChange={(event) => setAgentId(event.target.value)}>
                <option value="">Select agent</option>
                {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.cid}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model token</Label>
              <Select value={modelId} onChange={(event) => setModelId(event.target.value)}>
                <option value="">Select model token</option>
                {models.map((model) => <option key={model.id} value={model.id}>{model.provider} · {model.modelName}</option>)}
              </Select>
            </div>
            <Button variant="primary" disabled={!agentId || !modelId || createLink.isPending} onClick={() => createLink.mutate({ agentId, modelId })}>
              <Link2 className="h-4 w-4" />
              Create link
            </Button>
          </CardContent>
        </Card>
        <DataTable
          title="Active links"
          tableId="links"
          emptyMessage="No links yet. Pick an agent and a model token to create one."
          headers={["Agent", "Model", "Created", "Status", "Requests", "Tokens", "Actions"]}
          rows={links.map((link) => [
            <span key="agent" className="font-semibold text-[var(--ink)]">{agents.find((agent) => agent.id === link.agentId)?.name ?? "—"}</span>,
            models.find((model) => model.id === link.modelId)?.modelName ?? "—",
            new Date(link.createdAt).toLocaleDateString(),
            <StatusBadge key="status" status={link.status} />,
            formatNumber(link.requestCount),
            formatNumber(link.tokenConsumption),
            <Button key="action" size="icon" title="Unlink"><Unlink className="h-3.5 w-3.5" /></Button>,
          ])}
        />
      </div>
    </>
  );
}
