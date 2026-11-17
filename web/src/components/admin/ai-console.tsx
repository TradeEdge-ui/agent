"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Alert, Badge, Card } from "@/components/ui/primitives";
import { saveLeadQualification } from "@/actions/admin";
import type { AiContextType } from "@/lib/ai/tasks";

type TaskInfo = { id: string; label: string; description: string; context: AiContextType[]; output: string };
type Option = { id: string; label: string };
type Msg = { role: "user" | "assistant"; content: string };

type Qualification = {
  score: number; fit: string; summary: string; recommended_service_slug: string | null; budget_assessment: string;
  urgency: string; questions_to_ask: string[]; red_flags: string[]; next_step: string;
};

export function AiConsole({ tasks, options, initial, enabled }: {
  tasks: TaskInfo[];
  options: Record<Exclude<AiContextType, "none">, Option[]>;
  initial?: { task?: string; type?: AiContextType; id?: string };
  enabled: boolean;
}) {
  const [taskId, setTaskId] = useState(initial?.task ?? tasks[0].id);
  const task = tasks.find((t) => t.id === taskId)!;
  const [ctxType, setCtxType] = useState<AiContextType>(initial?.type && task.context.includes(initial.type) ? initial.type : task.context[0]);
  const [ctxId, setCtxId] = useState(initial?.id ?? "");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [history, setHistory] = useState<Msg[]>([]);
  const [structured, setStructured] = useState<{ kind: string; data: unknown; log_id: string | null } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function pickTask(id: string) {
    const t = tasks.find((x) => x.id === id)!;
    setTaskId(id);
    if (!t.context.includes(ctxType)) {
      setCtxType(t.context[0]);
      setCtxId("");
    }
    setText("");
    setStructured(null);
    setHistory([]);
  }

  async function run() {
    setBusy(true);
    setError(null);
    setStructured(null);
    setSaved(null);
    setText("");
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskId, context_type: ctxType, context_id: ctxType === "none" ? null : ctxId || null, instructions, history: taskId === "chat" ? history : [] }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Request failed" }));
        setError(j.error ?? "Request failed");
        return;
      }
      if (res.headers.get("content-type")?.includes("application/json")) {
        setStructured(await res.json());
        return;
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setText(acc);
      }
      if (taskId === "chat") setHistory((h) => [...h, { role: "user", content: instructions }, { role: "assistant", content: acc }]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const needsRecord = ctxType !== "none" && !ctxId;
  const q = structured?.kind === "lead_qualification" ? (structured.data as Qualification) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit space-y-4">
        {!enabled && <Alert tone="warning">Add ANTHROPIC_API_KEY to enable the assistant.</Alert>}
        <Field label="Task" htmlFor="ai-task">
          <Select id="ai-task" value={taskId} onChange={(e) => pickTask(e.target.value)}>{tasks.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select>
        </Field>
        <p className="text-xs text-subtle">{task.description}</p>
        <Field label="About" htmlFor="ai-ctx-type">
          <Select id="ai-ctx-type" value={ctxType} onChange={(e) => { setCtxType(e.target.value as AiContextType); setCtxId(""); }}>
            {task.context.map((c) => <option key={c} value={c}>{c === "none" ? "No record" : c}</option>)}
          </Select>
        </Field>
        {ctxType !== "none" && (
          <Field label={`Choose ${ctxType}`} htmlFor="ai-ctx-id">
            <Select id="ai-ctx-id" value={ctxId} onChange={(e) => setCtxId(e.target.value)}>
              <option value="">Select…</option>
              {options[ctxType].map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </Field>
        )}
        <Field label={taskId === "chat" ? "Your question" : "Extra instructions (optional)"} htmlFor="ai-instr">
          <Textarea id="ai-instr" rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={taskId === "chat" ? "E.g. How should I structure a booking flow in Next.js for a salon?" : "E.g. Keep it under RM2,000; client prefers WhatsApp"} />
        </Field>
        <Button type="button" className="w-full" disabled={!enabled || busy || needsRecord || (taskId === "chat" && !instructions.trim())} onClick={run}>
          {busy ? "Thinking…" : "Run"}
        </Button>
        {taskId === "chat" && history.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => { setHistory([]); setText(""); }}>New conversation</Button>}
        <p className="text-xs text-subtle">The assistant only drafts. It cannot send messages, change prices or billing, approve spending, issue refunds or publish anything — you decide.</p>
      </Card>

      <div className="min-w-0 space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {taskId === "chat" && history.length > 2 && (
          <Card className="max-h-80 space-y-3 overflow-y-auto">
            {history.slice(0, -2).map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-sm text-brand-200" : "whitespace-pre-wrap text-sm text-muted"}>{m.role === "user" ? `You: ${m.content}` : m.content}</div>
            ))}
          </Card>
        )}
        {(text || busy) && !structured && (
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <Badge tone="warning">Draft — review before using</Badge>
              {text && <Button type="button" variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(text)}>Copy</Button>}
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{text || "…"}</div>
          </Card>
        )}
        {q && (
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="warning">AI assessment — advisory</Badge>
              <p className="text-2xl font-semibold text-fg">{Math.max(0, Math.min(100, Math.round(q.score)))}/100</p>
              <Badge tone={q.fit === "strong" ? "success" : q.fit === "moderate" ? "info" : "neutral"}>{q.fit} fit</Badge>
              <Badge>urgency: {q.urgency}</Badge>
            </div>
            <p className="text-sm text-fg">{q.summary}</p>
            <p className="text-sm text-muted"><strong className="text-fg">Budget:</strong> {q.budget_assessment}</p>
            {q.recommended_service_slug && <p className="text-sm text-muted"><strong className="text-fg">Suggested package:</strong> {q.recommended_service_slug}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-sm font-medium text-fg">Questions to ask</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{q.questions_to_ask.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              <div><p className="text-sm font-medium text-fg">Red flags</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{q.red_flags.length ? q.red_flags.map((x, i) => <li key={i}>{x}</li>) : <li>None noted</li>}</ul></div>
            </div>
            <p className="text-sm text-muted"><strong className="text-fg">Next step:</strong> {q.next_step}</p>
            <div className="flex items-center gap-3">
              <Button type="button" size="sm" variant="secondary" onClick={async () => { const r = await saveLeadQualification(ctxId, q.score, q.summary, q); setSaved(r.message ?? null); }}>Save to lead</Button>
              {saved && <span className="text-xs text-emerald-300">{saved}</span>}
            </div>
          </Card>
        )}
        {structured?.kind === "quote_draft" && (
          <Card className="space-y-3">
            <Badge tone="warning">AI quotation draft</Badge>
            <p className="text-sm text-muted">Open it in the quotation editor to review every line, price and term. Nothing is saved or sent until you do so.</p>
            <pre className="max-h-96 overflow-auto rounded-xl bg-white/[0.03] p-3 text-xs text-muted">{JSON.stringify(structured.data, null, 2)}</pre>
            {structured.log_id && <Link className={buttonClass("primary", "sm")} href={`/admin/quotes/new?lead=${ctxId}&ai=${structured.log_id}`}>Open in quotation editor</Link>}
          </Card>
        )}
        {!text && !busy && !structured && !error && (
          <Card><p className="text-sm text-muted">Pick a task and a record, then run. Outputs are drafts for you to edit and approve.</p></Card>
        )}
      </div>
    </div>
  );
}
