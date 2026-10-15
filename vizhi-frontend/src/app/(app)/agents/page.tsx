"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Bot, Edit, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { FieldError, FieldHelp, Input, Label, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAgents, useCreateAgent } from "@/lib/api/queries";

const schema = z.object({
  name: z.string().min(2, "Agent name is required"),
  description: z.string().min(8, "Description is required"),
  tags: z.string().optional().default(""),
  tokenName: z.string().max(120).optional().default(""),
});

type FormValues = z.infer<typeof schema>;

export default function AgentsPage() {
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const { data = [] } = useAgents();
  const createAgent = useCreateAgent();
  const { register, handleSubmit } = useForm<FormValues>();

  function submit(values: FormValues) {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      return;
    }

    setErrors({});
    createAgent.mutate({
      name: parsed.data.name,
      description: parsed.data.description,
      tags: parsed.data.tags,
      tokenName: parsed.data.tokenName || undefined,
    });
  }

  return (
    <>
      <PageHeader title="Agents" description="Observable agent identities with stable CIDs, tags and lifecycle controls." />
      <div className="grid items-start gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Create agent</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit(submit)}>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input {...register("name")} placeholder="support-bot" />
                <FieldError message={errors.name} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea {...register("description")} />
                <FieldError message={errors.description} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <Input {...register("tags")} placeholder="ci, prod, staging" />
                </div>
                <div className="space-y-2">
                  <Label>
                    Token name <span className="font-normal text-[var(--ink-tertiary)]">(optional)</span>
                  </Label>
                  <Input
                    {...register("tokenName")}
                    placeholder="e.g. prod-ci-bot"
                    maxLength={120}
                  />
                  <FieldHelp>Shown in the token list</FieldHelp>
                </div>
              </div>
              <Button type="submit" variant="primary" disabled={createAgent.isPending}>
                <Bot className="h-4 w-4" />
                Create agent
              </Button>
            </form>
          </CardContent>
        </Card>
        <DataTable
          title="All agents"
          tableId="agents"
          emptyMessage="No agents yet. Create one to get a CID and API key."
          headers={["Agent", "CID", "Tags", "Status", "Actions"]}
          rows={data.map((agent) => [
            <div key="agent" className="min-w-0"><p className="font-semibold text-[var(--ink)]">{agent.name}</p><p className="max-w-xs truncate text-xs font-normal text-[var(--ink-tertiary)]">{agent.description}</p></div>,
            <span className="font-mono text-xs" key="cid">{agent.cid}</span>,
            agent.tags.length ? agent.tags.join(", ") : "—",
            <StatusBadge key="status" status={agent.status} />,
            <div className="flex gap-1.5" key="actions">
              <Button size="icon" title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="danger" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>,
          ])}
        />
      </div>
    </>
  );
}
