import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { getAnthropic, FALLBACK_BETA } from "@/lib/ai/client";
import { SYSTEM_PROMPT, catalogueContext, clientData } from "@/lib/ai/prompts";
import { leadQualificationSchema, quoteDraftSchema, type AiContextType, type AiTask } from "@/lib/ai/tasks";
import { env } from "@/lib/env";
import { formatMYR } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Service } from "@/lib/types";

type Admin = ReturnType<typeof createAdminClient>;

/** Builds the context block for a record. Only called from admin-only routes. */
export async function buildContext(admin: Admin, type: AiContextType, id: string | null): Promise<string> {
  if (type === "none" || !id) return "";
  if (type === "lead") {
    const { data: lead } = await admin.from("leads").select("*, services(name)").eq("id", id).single();
    if (!lead) throw new Error("Lead not found");
    const { data: insight } = await admin.from("lead_insights").select("internal_notes").eq("lead_id", id).maybeSingle();
    return [
      `Lead record (submitted ${lead.created_at}, source: ${lead.source}, status: ${lead.status}, interested in: ${lead.services?.name ?? "not specified"}).`,
      clientData("lead_form", {
        name: lead.name, company: lead.company, budget: lead.budget, timeline: lead.timeline,
        website: lead.website_url, message: lead.message, details: lead.details,
      }),
      insight?.internal_notes ? `Owner's private notes: ${insight.internal_notes}` : "",
    ].join("\n");
  }
  if (type === "project") {
    const { data: p } = await admin.from("projects").select("*, profiles(full_name, company_name), services(name)").eq("id", id).single();
    if (!p) throw new Error("Project not found");
    const [{ data: ms }, { data: ups }, { data: revs }, { data: invs }] = await Promise.all([
      admin.from("milestones").select("title,status,due_date").eq("project_id", id).order("sort_order"),
      admin.from("project_updates").select("body,is_internal,created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(8),
      admin.from("revision_requests").select("title,details,status").eq("project_id", id).order("created_at", { ascending: false }).limit(10),
      admin.from("invoices").select("number,status,total_cents,amount_paid_cents,kind").eq("project_id", id),
    ]);
    let quote = "";
    if (p.quote_id) {
      const { data: q } = await admin.from("quotes").select("summary,deliverables,exclusions,timeline_text").eq("id", p.quote_id).single();
      if (q) quote = `Accepted quotation scope: ${JSON.stringify(q)}`;
    }
    return [
      `Project ${p.number} "${p.name}" for ${p.profiles?.full_name ?? "client"}${p.profiles?.company_name ? ` (${p.profiles.company_name})` : ""}. Service: ${p.services?.name ?? "custom"}. Status: ${p.status}, progress ${p.progress}%, start ${p.start_date ?? "n/a"}, due ${p.due_date ?? "not set"}. Revisions included: ${p.revisions_included}.`,
      p.description ? clientData("project_description", p.description) : "",
      quote,
      `Milestones: ${JSON.stringify(ms ?? [])}`,
      `Recent updates (newest first): ${JSON.stringify(ups ?? [])}`,
      revs?.length ? clientData("revision_requests", revs) : "",
      `Invoices: ${(invs ?? []).map((i) => `${i.number} ${i.kind} ${i.status} ${formatMYR(i.total_cents)} paid ${formatMYR(i.amount_paid_cents)}`).join("; ")}`,
    ].filter(Boolean).join("\n");
  }
  if (type === "client") {
    const { data: c } = await admin.from("profiles").select("id,full_name,company_name,created_at").eq("id", id).single();
    if (!c) throw new Error("Client not found");
    const [{ data: projects }, { data: subs }, { data: leads }] = await Promise.all([
      admin.from("projects").select("name,status,total_cents,live_url,services(name)").eq("client_id", id),
      admin.from("subscriptions").select("plan_name,status,price_cents").eq("client_id", id),
      admin.from("leads").select("message,budget,created_at").eq("user_id", id).limit(5),
    ]);
    return [
      `Client: ${c.full_name ?? "unknown"}${c.company_name ? ` (${c.company_name})` : ""}, customer since ${c.created_at.slice(0, 10)}.`,
      `Projects: ${JSON.stringify(projects ?? [])}`,
      `Subscriptions: ${JSON.stringify(subs ?? [])}`,
      leads?.length ? clientData("past_requests", leads) : "",
    ].filter(Boolean).join("\n");
  }
  if (type === "quote") {
    const { data: q } = await admin.from("quotes").select("*").eq("id", id).single();
    if (!q) throw new Error("Quote not found");
    return `Quotation ${q.number} (${q.status}) for ${q.client_name ?? q.client_email}: "${q.title}", total ${formatMYR(q.total_cents)}, sent ${q.sent_at ?? "not yet"}, valid until ${q.valid_until ?? "n/a"}.\nSummary: ${q.summary ?? ""}`;
  }
  return "";
}

function baseParams(services: Service[]) {
  return {
    model: env.anthropicModel,
    betas: [FALLBACK_BETA],
    fallbacks: "default" as const,
    system: [
      { type: "text" as const, text: SYSTEM_PROMPT },
      { type: "text" as const, text: catalogueContext(services), cache_control: { type: "ephemeral" as const } },
    ],
  };
}

function userContent(task: AiTask, context: string, instructions: string) {
  return [
    `Task: ${task.instruction}`,
    context ? `\nContext:\n${context}` : "",
    instructions ? `\nOwner's additional instructions:\n${instructions}` : "",
  ].join("\n");
}

export type StructuredResult =
  | { ok: true; kind: "lead_qualification" | "quote_draft"; data: unknown; usage: { input: number; output: number }; model: string }
  | { ok: false; error: string };

export async function runStructured(task: AiTask, services: Service[], context: string, instructions: string): Promise<StructuredResult> {
  const client = getAnthropic();
  const schema = task.output === "lead_qualification" ? leadQualificationSchema : quoteDraftSchema;
  const msg = await client.beta.messages.parse({
    ...baseParams(services),
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content: userContent(task, context, instructions) }],
  });
  if (msg.stop_reason === "refusal") return { ok: false, error: "The AI declined this request. Try rephrasing your instructions." };
  if (!msg.parsed_output) return { ok: false, error: "The AI response could not be parsed. Please try again." };
  return {
    ok: true,
    kind: task.output as "lead_qualification" | "quote_draft",
    data: msg.parsed_output,
    usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens },
    model: msg.model,
  };
}

/** Streams a text task. Yields text chunks; returns usage at the end. */
export async function* runText(
  task: AiTask,
  services: Service[],
  context: string,
  instructions: string,
  history: { role: "user" | "assistant"; content: string }[],
): AsyncGenerator<string, { input: number; output: number; model: string; stop: string | null }> {
  const client = getAnthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userContent(task, context, instructions) },
  ];
  // The first message must be from the user.
  while (messages.length && messages[0].role !== "user") messages.shift();

  const stream = client.beta.messages.stream({
    ...baseParams(services),
    max_tokens: 32000,
    output_config: { effort: "medium" },
    messages,
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    yield "\n\n_The AI declined to continue this request. Try rephrasing._";
  }
  return { input: final.usage.input_tokens, output: final.usage.output_tokens, model: final.model, stop: final.stop_reason };
}
