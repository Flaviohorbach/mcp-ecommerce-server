"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_TOOLS, PERSONAS, type PersonaId } from "@/lib/personas";

interface ToolCall {
  id: string;
  name: string;
  state: string;
  input: unknown;
  output: unknown;
}

const failed = (call: ToolCall) => call.state === "output-error" || Boolean((call.output as { error?: unknown } | undefined)?.error);

/** The model answers in light Markdown: bold and bullets are all it uses here, so no parser is needed. */
function AnswerText({ text }: { text: string }) {
  const parts = text.replace(/^\s*\*\s+/gm, "• ").split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part))}</>;
}

function CallRow({ call, position }: { call: ToolCall; position: number }) {
  const running = call.state !== "output-available" && call.state !== "output-error";
  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs text-muted">{position}</span>
        <span className="font-mono font-medium">{call.name}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${running ? "bg-surface-2 text-muted" : failed(call) ? "bg-surface-2 text-danger" : "bg-accent-soft text-ok"}`}>
          {running ? "chamando…" : failed(call) ? "erro" : "ok"}
        </span>
      </p>
      <p className="mt-2 text-xs font-medium text-muted">Parâmetros</p>
      <pre className="mt-1 overflow-x-auto rounded-lg bg-surface-2 p-2 font-mono text-xs">{JSON.stringify(call.input ?? {}, null, 1)}</pre>
      {!running && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-muted">Resposta do servidor</summary>
          <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-surface-2 p-2 font-mono text-xs">{JSON.stringify(call.output, null, 1)}</pre>
        </details>
      )}
    </li>
  );
}

function Conversation({ personaId, onCalls }: { personaId: PersonaId; onCalls: (calls: ToolCall[]) => void }) {
  const persona = PERSONAS.find((p) => p.id === personaId)!;
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", body: { persona: personaId } }), [personaId]);
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  const calls = useMemo(
    () => messages.flatMap((m) => m.parts.flatMap((p): ToolCall[] => (p.type === "dynamic-tool" ? [{ id: p.toolCallId, name: p.toolName, state: p.state, input: p.input, output: p.state === "output-available" ? p.output : p.state === "output-error" ? { error: p.errorText } : undefined }] : []))),
    [messages],
  );
  useEffect(() => onCalls(calls), [calls, onCalls]);
  useEffect(() => {
    const end = endRef.current;
    if (messages.length > 0 && end) end.scrollIntoView({ block: "nearest" });
  }, [messages]);

  const ask = (value: string) => {
    const text = value.trim();
    if (!text || busy) return;
    setDraft("");
    void sendMessage({ text });
  };

  return (
    <section aria-label="Conversa" className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4">
      <div aria-live="polite" className="min-h-40 flex-1 space-y-3">
        {messages.length === 0 && <p className="text-sm text-muted">Pergunte algo e veja as chamadas MCP ao lado. {persona.description}</p>}
        {messages.map((message) => {
          const text = message.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");
          if (!text) return null;
          return (
            <p key={message.id} className={message.role === "user" ? "ml-auto w-fit max-w-[85%] rounded-xl bg-accent-soft px-3 py-2 text-sm" : "whitespace-pre-wrap text-sm"}>
              {message.role === "user" ? text : <AnswerText text={text} />}
            </p>
          );
        })}
        {status === "submitted" && <p className="text-sm text-muted">Pensando…</p>}
        {error && <p role="alert" className="text-sm text-danger">{error.message}</p>}
        <div ref={endRef} />
      </div>

      <ul aria-label="Exemplos de pergunta" className="mt-4 flex flex-wrap gap-2">
        {persona.examples.map((example) => (
          <li key={example}>
            <button type="button" disabled={busy} onClick={() => ask(example)} className="rounded-full border border-line px-3 py-1 text-left text-xs text-muted hover:border-accent hover:text-ink disabled:opacity-50">
              {example}
            </button>
          </li>
        ))}
      </ul>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <label htmlFor="question" className="sr-only">Sua pergunta</label>
        <input
          id="question"
          value={draft}
          maxLength={300}
          onChange={(e) => setDraft(e.currentTarget.value)}
          placeholder="Pergunte sobre produtos ou pedidos"
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-accent"
        />
        <button type="submit" disabled={busy} className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-ink disabled:opacity-50">Enviar</button>
      </form>
    </section>
  );
}

export function Playground() {
  const [personaId, setPersonaId] = useState<PersonaId>("customer");
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [tools, setTools] = useState<{ persona: PersonaId; names: string[] } | null>(null);
  const persona = PERSONAS.find((p) => p.id === personaId)!;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/tools?persona=${personaId}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((body: { tools: string[] }) => setTools({ persona: personaId, names: body.tools }))
      .catch(() => {});
    return () => controller.abort();
  }, [personaId]);

  const visible = tools?.persona === personaId ? tools.names : null;

  return (
    <div className="mt-6">
      <fieldset>
        <legend className="text-sm font-medium">Conectar ao servidor como</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PERSONAS.map((p) => (
            <label key={p.id} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm ${p.id === personaId ? "border-accent bg-accent-soft font-medium" : "border-line bg-surface text-muted"}`}>
              <input
                type="radio"
                name="persona"
                value={p.id}
                checked={p.id === personaId}
                onChange={() => {
                  setPersonaId(p.id);
                  setCalls([]);
                }}
                className="sr-only"
              />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* A new key restarts the conversation: each persona is a new connection with another token. */}
        <Conversation key={personaId} personaId={personaId} onCalls={setCalls} />

        <section aria-label="Protocolo" className="min-w-0">
          <h2 className="font-display font-semibold">O que este token enxerga</h2>
          <p className="mt-1 text-xs text-muted">
            Escopos: {persona.scopes.map((scope) => <code key={scope} className="mr-1 font-mono">{scope}</code>)}
          </p>
          <ul aria-label="Ferramentas" className="mt-2 flex flex-wrap gap-2">
            {ALL_TOOLS.map((name) => {
              const has = visible?.includes(name);
              return (
                <li key={name} className={`rounded-lg border px-2 py-1 font-mono text-xs ${has ? "border-accent text-ink" : "border-dashed border-line text-muted line-through"}`}>
                  {name}
                  {visible && !has && <span className="sr-only"> (indisponível para este token)</span>}
                </li>
              );
            })}
          </ul>

          <h2 className="mt-5 font-display font-semibold">Chamadas MCP</h2>
          {calls.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-line p-4 text-sm text-muted">Nenhuma chamada ainda.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {calls.map((call, i) => <CallRow key={call.id} call={call} position={i + 1} />)}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
