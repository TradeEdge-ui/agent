import { z } from "zod";

export type AiContextType = "lead" | "project" | "client" | "quote" | "none";

export type AiTask = {
  id: string;
  label: string;
  description: string;
  context: AiContextType[];
  output: "text" | "lead_qualification" | "quote_draft";
  instruction: string;
};

export const AI_TASKS: AiTask[] = [
  {
    id: "qualify_lead",
    label: "Qualify lead",
    description: "Score fit, budget and urgency; list questions to ask.",
    context: ["lead"],
    output: "lead_qualification",
    instruction:
      "Qualify this lead for ARyzz AI Solutions. Score 0-100 for how good a fit and how likely to convert it is, assess budget versus our catalogue, urgency, red flags, the questions the owner should ask on a discovery call, and the single best next step.",
  },
  {
    id: "draft_quote",
    label: "Draft quotation",
    description: "Suggest line items, payment schedule, deliverables and exclusions.",
    context: ["lead"],
    output: "quote_draft",
    instruction:
      "Draft a quotation for this lead based on our catalogue. Use prices within the catalogue ranges unless the scope clearly requires more, and explain assumptions. Unit prices are in RM (not sen). The payment schedule percentages must add up to exactly 100. List anything the owner must confirm before sending.",
  },
  {
    id: "summarize_requirements",
    label: "Summarise requirements",
    description: "Turn a messy brief into a clear requirements summary.",
    context: ["lead", "project"],
    output: "text",
    instruction:
      "Summarise the client's requirements as: Goal, Audience, Must-have features, Nice-to-haves, Content/assets needed from the client, Integrations, Open questions, Risks.",
  },
  {
    id: "project_plan",
    label: "Generate project plan",
    description: "Phases, milestones and tasks for delivery.",
    context: ["project", "lead"],
    output: "text",
    instruction:
      "Create a practical delivery plan for a solo developer using AI-assisted development: phases, milestones with acceptance criteria, task checklist per milestone, what to request from the client and when, and risks. Use relative durations (e.g. 'Week 1') and do not promise calendar dates.",
  },
  {
    id: "recommend_stack",
    label: "Recommend structure & tech",
    description: "Sitemap/page structure and technology choice.",
    context: ["lead", "project"],
    output: "text",
    instruction:
      "Recommend a website/app structure (sitemap or screens with purpose of each) and a cost-efficient technology stack suited to a Malaysian SME and a solo developer. Compare 2 options briefly with trade-offs (cost, maintenance, client editing), then recommend one.",
  },
  {
    id: "client_update",
    label: "Draft client update",
    description: "Progress update email based on milestones and recent activity.",
    context: ["project"],
    output: "text",
    instruction:
      "Draft a short, friendly progress update email to the client: what was completed, what is next, anything we need from them. Do not promise dates unless they appear in the project data; use [CONFIRM DATE] otherwise.",
  },
  {
    id: "follow_up",
    label: "Draft follow-up message",
    description: "Polite follow-up for a lead or quotation.",
    context: ["lead", "quote"],
    output: "text",
    instruction:
      "Draft two versions of a polite follow-up: (1) an email, (2) a short WhatsApp message. Reference their specific needs. No pressure tactics, no discounts unless the owner asked for one.",
  },
  {
    id: "upsell",
    label: "Find upsell opportunities",
    description: "Genuine add-ons that fit this client's situation.",
    context: ["client", "project"],
    output: "text",
    instruction:
      "Identify up to 3 genuine upsell or cross-sell opportunities from our catalogue (e.g. maintenance plans, AI chatbot, automation) that would help this client. For each: why it fits, expected benefit, suggested way to raise it. If none fit, say so.",
  },
  {
    id: "chat",
    label: "Ask anything",
    description: "Development help, copywriting, pricing thoughts.",
    context: ["none", "lead", "project", "client", "quote"],
    output: "text",
    instruction: "Answer the owner's request.",
  },
];

export function getTask(id: string): AiTask | undefined {
  return AI_TASKS.find((t) => t.id === id);
}

// Structured output schemas. Numeric bounds are enforced after parsing.
export const leadQualificationSchema = z.object({
  score: z.number(),
  fit: z.enum(["strong", "moderate", "weak"]),
  summary: z.string(),
  recommended_service_slug: z.string().nullable(),
  budget_assessment: z.string(),
  urgency: z.enum(["high", "medium", "low", "unknown"]),
  questions_to_ask: z.array(z.string()),
  red_flags: z.array(z.string()),
  next_step: z.string(),
});
export type LeadQualification = z.infer<typeof leadQualificationSchema>;

export const quoteDraftSchema = z.object({
  title: z.string(),
  summary: z.string(),
  service_slug: z.string().nullable(),
  line_items: z.array(z.object({ description: z.string(), quantity: z.number(), unit_price_rm: z.number() })),
  payment_schedule: z.array(z.object({ label: z.string(), percent: z.number() })),
  deliverables: z.array(z.string()),
  exclusions: z.array(z.string()),
  revisions_included: z.number(),
  timeline_text: z.string(),
  assumptions: z.array(z.string()),
  confirm_before_sending: z.array(z.string()),
});
export type QuoteDraft = z.infer<typeof quoteDraftSchema>;

/** Converts an AI quote draft into safe editor defaults (never auto-saved). */
export function quoteDraftToEditor(d: QuoteDraft) {
  const items = d.line_items
    .filter((i) => i.description && Number.isFinite(i.unit_price_rm) && i.unit_price_rm >= 0)
    .slice(0, 50)
    .map((i) => ({
      description: i.description.slice(0, 500),
      quantity: Math.max(1, Math.min(10000, Number(i.quantity) || 1)),
      unit_price_cents: Math.round(i.unit_price_rm * 100),
    }));
  let schedule = d.payment_schedule
    .filter((s) => s.label && s.percent > 0)
    .slice(0, 10)
    .map((s) => ({ label: s.label.slice(0, 120), percent: Math.round(s.percent * 100) / 100 }));
  const sum = schedule.reduce((a, s) => a + s.percent, 0);
  if (schedule.length === 0 || Math.abs(sum - 100) > 0.001) {
    schedule = [
      { label: "Deposit", percent: 50 },
      { label: "Final payment on completion", percent: 50 },
    ];
  }
  return {
    title: d.title.slice(0, 200),
    summary: d.summary.slice(0, 5000),
    line_items: items,
    payment_schedule: schedule,
    deliverables: d.deliverables.slice(0, 40).map((s) => s.slice(0, 500)),
    exclusions: d.exclusions.slice(0, 40).map((s) => s.slice(0, 500)),
    revisions_included: Math.max(0, Math.min(20, Math.round(d.revisions_included) || 2)),
    timeline_text: d.timeline_text.slice(0, 200),
    service_slug: d.service_slug,
    notes_for_owner: [...d.assumptions, ...d.confirm_before_sending],
  };
}
