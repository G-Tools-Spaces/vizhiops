"use client";

import { useRef, useState } from "react";
import {
  Bot,
  Send,
  Square,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  /** true while the assistant is still streaming */
  streaming?: boolean;
  /** metadata filled when streaming completes */
  meta?: {
    provider?: string;
    model?: string;
    usedFallback?: boolean;
    queryId?: string;
    latencyMs?: number;
  };
}

interface PlaygroundConfig {
  token: string;
  baseUrl: string;
  model: string;
  temperature: string;
  maxTokens: string;
  systemPrompt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_VIZHI_BASE_URL ?? "http://localhost:8000";

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
  const [config, setConfig] = useState<PlaygroundConfig>({
    token: "",
    baseUrl: DEFAULT_BASE_URL,
    model: "",
    temperature: "0.7",
    maxTokens: "1024",
    systemPrompt: "",
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function cfg(key: keyof PlaygroundConfig, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  function stopStream() {
    abortRef.current?.abort();
  }

  // ── Send ─────────────────────────────────────────────────────────────────────

  async function send() {
    const userText = input.trim();
    if (!userText || isStreaming) return;
    if (!config.token) {
      setError("Paste a Model Token in the config panel first.");
      return;
    }

    setError(null);
    setInput("");

    const userMsg: Message = { role: "user", content: userText };
    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    scrollToBottom();

    // Build the message array to send (include system prompt if set)
    const history: { role: string; content: string }[] = [];
    if (config.systemPrompt.trim()) {
      history.push({ role: "system", content: config.systemPrompt.trim() });
    }
    [...messages, userMsg].forEach((m) => history.push({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      messages: history,
      stream: true,
    };
    if (config.model.trim()) body.model = config.model.trim();
    if (config.temperature) body.temperature = parseFloat(config.temperature);
    if (config.maxTokens) body.max_tokens = parseInt(config.maxTokens, 10);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsStreaming(true);

    try {
      const resp = await fetch(
        `${config.baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.token}`,
          },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText}`);
      }

      const queryId = resp.headers.get("x-vizhi-query-id") ?? undefined;
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let meta: Message["meta"] = { queryId };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        // Parse SSE lines
        const lines = accumulated.split("\n");
        accumulated = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta;
            const token: string = delta?.content ?? "";

            // Capture metadata from first chunk that has it
            if (json.model && !meta?.model) meta = { ...meta, model: json.model };
            if (json.vizhi_metadata) {
              const vm = json.vizhi_metadata;
              meta = {
                ...meta,
                provider: vm.provider,
                model: vm.model ?? meta?.model,
                usedFallback: vm.used_fallback,
                latencyMs: vm.latency_ms,
              };
            }

            if (token) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = { ...last, content: last.content + token };
                }
                return next;
              });
              scrollToBottom();
            }
          } catch {
            // malformed chunk — skip
          }
        }
      }

      // Mark streaming complete + attach metadata
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, streaming: false, meta };
        }
        return next;
      });
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        // user cancelled — just stop, keep what was streamed
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, streaming: false };
          }
          return next;
        });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        // Remove the empty assistant bubble
        setMessages((prev) => {
          const next = [...prev];
          if (next[next.length - 1]?.role === "assistant" && !next[next.length - 1].content) {
            next.pop();
          }
          return next;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Live Chat Playground"
        description="Test any model token with real-time streaming — verify routing, fallback, and latency before shipping."
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* ── Config Panel ──────────────────────────────────────────────── */}
        <aside className="space-y-4">
          <Card className="p-4 space-y-4">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
              Configuration
            </p>

            <Field label="Model Token *">
              <input
                type="password"
                placeholder="vz_live_..."
                value={config.token}
                onChange={(e) => cfg("token", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Base URL">
              <input
                type="text"
                placeholder="http://localhost:8000"
                value={config.baseUrl}
                onChange={(e) => cfg("baseUrl", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Model (optional)">
              <input
                type="text"
                placeholder="Leave blank — token picks model"
                value={config.model}
                onChange={(e) => cfg("model", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Temperature">
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) => cfg("temperature", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Max Tokens">
              <input
                type="number"
                min="1"
                max="32000"
                step="1"
                value={config.maxTokens}
                onChange={(e) => cfg("maxTokens", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="System Prompt">
              <textarea
                rows={3}
                placeholder="You are a helpful assistant."
                value={config.systemPrompt}
                onChange={(e) => cfg("systemPrompt", e.target.value)}
                className={cn(inputCls, "resize-none")}
              />
            </Field>
          </Card>

          {/* Tips */}
          <Card className="p-4 space-y-2 text-xs text-[var(--muted)]">
            <p className="font-semibold text-white">Tips</p>
            <p>• Get a <strong>Model Token</strong> from Models → Tokens.</p>
            <p>• <strong>Stream=true</strong> is always used for real-time output.</p>
            <p>• Press <kbd className="font-mono bg-white/10 px-1 rounded">Enter</kbd> to send, <kbd className="font-mono bg-white/10 px-1 rounded">Shift+Enter</kbd> for newline.</p>
            <p>• Click <strong>Stop</strong> to cancel mid-stream.</p>
          </Card>
        </aside>

        {/* ── Chat Panel ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Messages */}
          <Card className="flex-1 min-h-[480px] max-h-[640px] overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-center text-sm text-[var(--muted)]">
                <div>
                  <Zap className="mx-auto mb-3 h-8 w-8 opacity-30" />
                  <p>No messages yet.</p>
                  <p className="mt-1 text-xs">Configure a token and send a message to start.</p>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/20 text-[var(--accent)]">
                    <Bot className="h-4 w-4" />
                  </span>
                )}

                <div className={cn("max-w-[80%] space-y-1", msg.role === "user" && "items-end")}>
                  <div
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-[var(--accent)] text-black"
                        : "bg-white/[0.06] text-[var(--foreground)]"
                    )}
                  >
                    {msg.content}
                    {msg.streaming && (
                      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
                    )}
                  </div>

                  {/* Metadata badge shown when stream is done */}
                  {msg.role === "assistant" && !msg.streaming && msg.meta && (
                    <div className="flex flex-wrap gap-2 text-[10px] text-[var(--muted)]">
                      {msg.meta.provider && (
                        <span className="rounded bg-white/[0.05] px-1.5 py-0.5">
                          {msg.meta.provider}
                        </span>
                      )}
                      {msg.meta.model && (
                        <span className="rounded bg-white/[0.05] px-1.5 py-0.5">
                          {msg.meta.model}
                        </span>
                      )}
                      {msg.meta.usedFallback && (
                        <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-yellow-400">
                          fallback used
                        </span>
                      )}
                      {msg.meta.latencyMs != null && (
                        <span className="rounded bg-white/[0.05] px-1.5 py-0.5">
                          {msg.meta.latencyMs}ms
                        </span>
                      )}
                      {msg.meta.queryId && (
                        <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono">
                          {msg.meta.queryId.slice(0, 16)}…
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                    <User className="h-4 w-4" />
                  </span>
                )}
              </div>
            ))}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </Card>

          {/* Input area */}
          <Card className="flex items-end gap-2 p-3">
            <textarea
              rows={2}
              placeholder="Type a message… (Enter to send)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={isStreaming}
              className={cn(
                "flex-1 resize-none bg-transparent text-sm text-white placeholder:text-[var(--muted)] outline-none disabled:opacity-50"
              )}
            />

            <div className="flex shrink-0 gap-2">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Clear chat"
                  onClick={clearChat}
                  disabled={isStreaming}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              {isStreaming ? (
                <Button variant="danger" size="icon" title="Stop" onClick={stopStream}>
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="icon"
                  title="Send"
                  onClick={send}
                  disabled={!input.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

// ── Tiny internal Field helper ────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[var(--muted)]">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition";
