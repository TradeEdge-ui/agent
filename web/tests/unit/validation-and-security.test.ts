import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { quoteEditorSchema, quoteRequestSchema, registerSchema, serviceEditorSchema } from "@/lib/validation";
import { safeNext } from "@/lib/redirect";
import { dbErrorMessage } from "@/lib/action-state";
import { quoteDraftToEditor } from "@/lib/ai/tasks";
import catalog from "@/content/catalog.json";
import { buildSeedSql } from "../../scripts/generate-seed.mjs";

const baseQuote = {
  client_email: "Client@Example.com",
  title: "Business website",
  line_items: [{ description: "Website", quantity: 1, unit_price_cents: 200000 }],
  payment_schedule: [{ label: "Deposit", percent: 50 }, { label: "Final", percent: 50 }],
  revisions_included: 3,
};

describe("input validation", () => {
  it("normalises emails and requires payment schedules to total 100%", () => {
    const ok = quoteEditorSchema.safeParse(baseQuote);
    expect(ok.success && ok.data.client_email).toBe("client@example.com");
    const bad = quoteEditorSchema.safeParse({ ...baseQuote, payment_schedule: [{ label: "Deposit", percent: 60 }] });
    expect(bad.success).toBe(false);
  });

  it("rejects negative or fractional prices in quotations", () => {
    expect(quoteEditorSchema.safeParse({ ...baseQuote, line_items: [{ description: "x", quantity: 1, unit_price_cents: -1 }] }).success).toBe(false);
    expect(quoteEditorSchema.safeParse({ ...baseQuote, line_items: [{ description: "x", quantity: 1, unit_price_cents: 10.5 }] }).success).toBe(false);
  });

  it("requires consent and a meaningful brief on quote requests", () => {
    const base = { name: "Aina", email: "aina@example.com", goals: "We need a bilingual website for our bakery with online orders." };
    expect(quoteRequestSchema.safeParse(base).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...base, consent: "on" }).success).toBe(true);
    expect(quoteRequestSchema.safeParse({ ...base, consent: "on", goals: "hi" }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...base, consent: "on", website_url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("enforces password strength on registration", () => {
    const base = { full_name: "Aina", email: "aina@example.com", terms: "on" };
    expect(registerSchema.safeParse({ ...base, password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "onlyletterslong" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "longenough123" }).success).toBe(true);
  });

  it("requires a base price before a service can be bought online", () => {
    const svc = {
      slug: "x", category: "website", name: "Starter", price_min_cents: null, price_max_cents: null, billing_type: "one_time",
      purchase_mode: "direct", deposit_percent: 50, deliverables: [], exclusions: [], revisions_included: 1, is_featured: false, is_active: true, sort_order: 1,
    };
    expect(serviceEditorSchema.safeParse(svc).success).toBe(false);
    expect(serviceEditorSchema.safeParse({ ...svc, price_min_cents: 50000 }).success).toBe(true);
    expect(serviceEditorSchema.safeParse({ ...svc, price_min_cents: 50000, price_max_cents: 100 }).success).toBe(false);
  });
});

describe("security helpers", () => {
  it("prevents open redirects after login", () => {
    expect(safeNext("/dashboard/invoices")).toBe("/dashboard/invoices");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
    expect(safeNext(null, "/admin")).toBe("/admin");
  });

  it("does not leak database internals in error messages", () => {
    expect(dbErrorMessage({ message: 'new row violates row-level security policy for table "x"' })).toMatch(/Something went wrong/);
    expect(dbErrorMessage({ message: "This quotation has expired. Please ask us for an updated quote." })).toMatch(/expired/);
  });
});

describe("AI quotation drafts", () => {
  it("are sanitised before reaching the editor and never trusted blindly", () => {
    const e = quoteDraftToEditor({
      title: "Site", summary: "s", service_slug: "business-website",
      line_items: [{ description: "Build", quantity: 1, unit_price_rm: 2500.5 }, { description: "", quantity: 1, unit_price_rm: 5 }, { description: "Bad", quantity: 1, unit_price_rm: -10 }],
      payment_schedule: [{ label: "Deposit", percent: 70 }],
      deliverables: ["a"], exclusions: ["b"], revisions_included: 99, timeline_text: "3 weeks", assumptions: ["x"], confirm_before_sending: ["price"],
    });
    expect(e.line_items).toEqual([{ description: "Build", quantity: 1, unit_price_cents: 250050 }]);
    expect(e.payment_schedule.reduce((a, s) => a + s.percent, 0)).toBe(100);
    expect(e.revisions_included).toBe(20);
    expect(e.notes_for_owner).toEqual(["x", "price"]);
  });
});

describe("catalogue seed", () => {
  it("is in sync with src/content/catalog.json (run scripts/generate-seed.mjs after edits)", () => {
    const file = readFileSync(join(__dirname, "../../supabase/migrations/20261117000005_seed.sql"), "utf8");
    expect(file).toBe(buildSeedSql(catalog.services));
  });

  it("matches the agreed starting prices", () => {
    const price = (slug: string) => catalog.services.find((s) => s.slug === slug)!;
    expect([price("starter-website").price_min_cents, price("starter-website").price_max_cents]).toEqual([79900, 149900]);
    expect([price("business-website").price_min_cents, price("business-website").price_max_cents]).toEqual([150000, 399900]);
    expect([price("ecommerce-website").price_min_cents, price("ecommerce-website").price_max_cents]).toEqual([300000, 799900]);
    expect(price("custom-web-application").price_min_cents).toBeNull();
    expect(price("ai-chatbot-integration").price_min_cents).toBe(49900);
    expect(price("ai-workflow-automation").price_min_cents).toBe(99900);
    expect(price("ai-customer-support-system").price_min_cents).toBe(149900);
    expect(price("custom-ai-agent").price_min_cents).toBeNull();
    expect(price("basic-maintenance").price_min_cents).toBe(9900);
    expect(price("business-maintenance").price_min_cents).toBe(24900);
    expect(price("premium-maintenance").price_min_cents).toBe(49900);
    for (const s of catalog.services) {
      expect(s.deliverables.length).toBeGreaterThan(0);
      expect(s.exclusions.length).toBeGreaterThan(0);
    }
  });
});
