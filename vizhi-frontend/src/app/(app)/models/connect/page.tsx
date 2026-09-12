"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { CheckCircle, KeyRound } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { useCreateModelConnection, useModelCatalog } from "@/lib/api/queries";

const schema = z.object({
  provider: z.string().min(1, "Provider is required"),
  modelName: z.string().min(2, "Model name is required"),
  tokenName: z.string().max(120).optional().default(""),
  metadata: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ConnectModelPage() {
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const createModel = useCreateModelConnection();
  const modelCatalog = useModelCatalog();
  const { register, control, handleSubmit, setValue } = useForm<FormValues>({
    defaultValues: {
      provider: "",
      modelName: "",
      metadata: "",
    },
  });

  const selectedProvider = useWatch({ control, name: "provider" });
  const providers = useMemo(() => modelCatalog.data ?? [], [modelCatalog.data]);
  const activeProvider = providers.find((provider) => provider.id === selectedProvider);
  const availableModels = activeProvider?.models ?? [];
  const catalogError = modelCatalog.error instanceof Error
    ? modelCatalog.error.message
    : undefined;

  useEffect(() => {
    if (!providers.length || selectedProvider) {
      return;
    }

    setValue("provider", providers[0].id);
  }, [providers, selectedProvider, setValue]);

  useEffect(() => {
    const nextModels = providers.find((provider) => provider.id === selectedProvider)?.models ?? [];
    if (!nextModels.length) {
      setValue("modelName", "");
      return;
    }

    setValue("modelName", nextModels[0].id);
  }, [providers, selectedProvider, setValue]);

  function submit(values: FormValues) {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      return;
    }

    setErrors({});
    createModel.mutate(
      {
        provider: parsed.data.provider,
        modelName: parsed.data.modelName,
        tokenName: parsed.data.tokenName || undefined,
        metadata: parsed.data.metadata,
      },
      {
        onSuccess(data) {
          setGeneratedToken(data.apiKey);
        },
      }
    );
  }

  return (
    <>
      <PageHeader title="Connect Model Provider" description="Create an LLM provider configuration, validate connectivity, and generate a reusable Vizhi model token." />
      <form onSubmit={handleSubmit(submit)} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Provider Configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select {...register("provider")} disabled={modelCatalog.isLoading}>
                {modelCatalog.isLoading ? <option>Loading providers...</option> : null}
                {!modelCatalog.isLoading && !providers.length ? <option>No providers available</option> : null}
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </Select>
              <FieldError message={errors.provider} />
              <FieldError message={catalogError ? `Could not load providers: ${catalogError}` : undefined} />
            </div>
            <div className="space-y-2">
              <Label>Model Name</Label>
               <Select {...register("modelName")} disabled={modelCatalog.isLoading || !availableModels.length}>
               {modelCatalog.isLoading ? <option>Loading models...</option> : null}
               {!modelCatalog.isLoading && !availableModels.length ? <option>No models available</option> : null}
               {availableModels.map((model)=> <option key={model.id} value={model.id}>{model.label}</option>)}
               </Select>
              <FieldError message={errors.modelName} />
            </div>
            <div className="space-y-2">
              <Label>
                Token Name <span className="text-[var(--muted)] font-normal">(optional)</span>
              </Label>
              <Input
                {...register("tokenName")}
                placeholder="e.g. production-gpt4o"
                maxLength={120}
              />
              <p className="text-xs text-[var(--muted)]">A friendly label shown in the token list</p>
              <FieldError message={errors.tokenName} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea {...register("metadata")} />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" variant="primary" disabled={createModel.isPending || modelCatalog.isLoading || !availableModels.length}>
                <KeyRound className="h-4 w-4" />
                Generate Model Token
              </Button>
            </div>
            {generatedToken ? (
              <div className="md:col-span-2 rounded-lg border border-slate-500/20 bg-slate-950/80 p-4 text-sm text-slate-100">
                <p className="font-semibold">Vizhi model token created</p>
                <p className="mt-2 break-all text-xs">{generatedToken}</p>
                <p className="mt-2 text-[var(--muted)]">This token is shown only once. Store it securely.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Security Contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <p>
              Vizhi generates a reusable model token and stores only a masked version. The raw token is shown once after creation.
              </p>
            <div className="rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-100">
              <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Token creation is handled by Vizhi</span>
            </div>
          </CardContent>
        </Card>
      </form>
    </>
  );
}
