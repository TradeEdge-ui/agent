import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters`);
const optionalText = (max: number) =>
  z.string().trim().max(max, `Must be at most ${max} characters`).optional().transform((v) => (v ? v : null));

export const nameSchema = trimmed(120).min(2, "Please enter your name");
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email address")).pipe(z.string().max(254));
// Malaysian & international numbers: digits, spaces, +, -, ()
export const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+0-9()\-\s]{7,30}$/, "Please enter a valid phone number")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const urlOptional = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https?:\/\/[^\s]+$/i.test(v), "Please enter a full URL starting with https://");

export const BUDGET_OPTIONS = [
  "Below RM1,000",
  "RM1,000 – RM3,000",
  "RM3,000 – RM8,000",
  "RM8,000 – RM20,000",
  "Above RM20,000",
  "Not sure yet",
] as const;

export const TIMELINE_OPTIONS = ["As soon as possible", "Within 1 month", "1–3 months", "Flexible"] as const;

export const quoteRequestSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company: optionalText(160),
  service_slug: z.string().trim().max(80).optional().transform((v) => (v ? v : null)),
  budget: z.enum(BUDGET_OPTIONS).optional().or(z.literal("")).transform((v) => (v ? v : null)),
  timeline: z.enum(TIMELINE_OPTIONS).optional().or(z.literal("")).transform((v) => (v ? v : null)),
  website_url: urlOptional,
  goals: trimmed(4000).min(20, "Please describe your project in at least 20 characters"),
  pages_or_features: optionalText(3000),
  references: optionalText(1500),
  consent: z.literal("on", { message: "Please agree to the Privacy Policy so we can contact you" }),
});

export const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company: optionalText(160),
  message: trimmed(4000).min(10, "Please write a short message"),
  consent: z.literal("on", { message: "Please agree to the Privacy Policy so we can reply" }),
});

export const bookingSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company: optionalText(160),
  topic: trimmed(200).min(3, "What would you like to discuss?"),
  notes: optionalText(2000),
  slot: z.iso.datetime({ message: "Please pick a time slot", offset: true }),
  consent: z.literal("on", { message: "Please agree to the Privacy Policy" }),
});

export const registerSchema = z.object({
  full_name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company_name: optionalText(160),
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(72, "Use at most 72 characters")
    .regex(/[a-z]/i, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
  terms: z.literal("on", { message: "Please accept the Terms and Privacy Policy" }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(72),
});

export const profileSchema = z.object({
  full_name: nameSchema,
  phone: phoneSchema,
  company_name: optionalText(160),
  marketing_opt_in: z.literal("on").optional().transform((v) => v === "on"),
});

export const projectRequestSchema = z.object({
  service_slug: z.string().trim().max(80).optional().transform((v) => (v ? v : null)),
  title: trimmed(160).min(3, "Give your request a short title"),
  goals: trimmed(4000).min(20, "Please describe what you need in at least 20 characters"),
  budget: z.enum(BUDGET_OPTIONS).optional().or(z.literal("")).transform((v) => (v ? v : null)),
  timeline: z.enum(TIMELINE_OPTIONS).optional().or(z.literal("")).transform((v) => (v ? v : null)),
  website_url: urlOptional,
});

export const revisionSchema = z.object({
  project_id: z.uuid(),
  title: trimmed(200).min(3, "Add a short title"),
  details: trimmed(5000).min(10, "Describe the change you need"),
});

export const commentSchema = z.object({
  project_id: z.uuid(),
  body: trimmed(5000).min(1, "Write a message"),
});

export const testimonialSchema = z.object({
  author_name: nameSchema,
  author_title: optionalText(120),
  company: optionalText(160),
  quote: trimmed(2000).min(10, "Please write at least a sentence"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  project_id: z.uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  consent: z.literal("on", { message: "We need your permission to publish your testimonial" }),
});

// ------------------------------------------------------------------- admin
export const lineItemSchema = z.object({
  description: trimmed(500).min(1, "Description required"),
  quantity: z.coerce.number().positive().max(10000),
  unit_price_cents: z.coerce.number().int().min(0).max(100_000_000),
});

export const scheduleItemSchema = z.object({
  label: trimmed(120).min(1),
  percent: z.coerce.number().positive().max(100),
});

export const quoteEditorSchema = z
  .object({
    client_email: emailSchema,
    client_name: optionalText(120),
    lead_id: z.uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    service_id: z.uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    recommended_service_id: z.uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    title: trimmed(200).min(3),
    summary: optionalText(5000),
    line_items: z.array(lineItemSchema).min(1, "Add at least one line item").max(50),
    discount_cents: z.coerce.number().int().min(0).default(0),
    tax_rate: z.coerce.number().min(0).max(100).default(0),
    payment_schedule: z.array(scheduleItemSchema).min(1).max(10),
    deliverables: z.array(trimmed(500).min(1)).max(40).default([]),
    exclusions: z.array(trimmed(500).min(1)).max(40).default([]),
    revisions_included: z.coerce.number().int().min(0).max(20),
    timeline_text: optionalText(200),
    valid_until: z.iso.date().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    terms: optionalText(8000),
  })
  .superRefine((q, ctx) => {
    const sum = q.payment_schedule.reduce((s, i) => s + i.percent, 0);
    if (Math.abs(sum - 100) > 0.001) {
      ctx.addIssue({ code: "custom", path: ["payment_schedule"], message: `Payment schedule must add up to 100% (currently ${sum}%)` });
    }
  });

export const serviceEditorSchema = z
  .object({
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
    category: z.enum(["website", "ai", "maintenance"]),
    name: trimmed(120).min(2),
    tagline: optionalText(200),
    description: optionalText(3000),
    price_min_cents: z.number().int().min(0).nullable(),
    price_max_cents: z.number().int().min(0).nullable(),
    price_notes: optionalText(1000),
    billing_type: z.enum(["one_time", "monthly"]),
    purchase_mode: z.enum(["direct", "quote"]),
    deposit_percent: z.coerce.number().int().min(1).max(100),
    deliverables: z.array(trimmed(500).min(1)).max(40),
    exclusions: z.array(trimmed(500).min(1)).max(40),
    revisions_included: z.coerce.number().int().min(0).max(50),
    timeline_text: optionalText(200),
    is_featured: z.boolean(),
    is_active: z.boolean(),
    sort_order: z.coerce.number().int().min(0).max(10000),
  })
  .superRefine((s, ctx) => {
    if (s.price_min_cents != null && s.price_max_cents != null && s.price_max_cents < s.price_min_cents) {
      ctx.addIssue({ code: "custom", path: ["price_max_cents"], message: "Maximum must be at least the minimum" });
    }
    if (s.purchase_mode === "direct" && (!s.price_min_cents || s.price_min_cents <= 0)) {
      ctx.addIssue({ code: "custom", path: ["price_min_cents"], message: "Direct purchase needs a base price" });
    }
  });

export const expenseSchema = z.object({
  incurred_on: z.iso.date(),
  category: trimmed(60).min(2),
  description: trimmed(300).min(2),
  vendor: optionalText(120),
  amount: z.string().trim().min(1, "Amount required"),
  project_id: z.uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
});

export const manualPaymentSchema = z.object({
  invoice_id: z.uuid(),
  amount: z.string().trim().min(1),
  method: z.enum(["bank_transfer", "duitnow", "cash", "cheque", "other"]),
  reference: trimmed(200).min(2, "Enter the bank / DuitNow reference"),
  paid_on: z.iso.date(),
});

export const EXPENSE_CATEGORIES = [
  "Software & subscriptions",
  "Hosting & domains",
  "AI / API usage",
  "Payment fees",
  "Advertising & marketing",
  "Contractors",
  "Equipment",
  "Professional fees",
  "Other",
] as const;
