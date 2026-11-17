import { QuoteEditor, type QuoteEditorValues } from "@/components/admin/quote-editor";
import { PageHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { getBusinessSettings } from "@/lib/settings";
import { quoteDraftSchema, quoteDraftToEditor } from "@/lib/ai/tasks";
import type { Service } from "@/lib/types";

const DEFAULT_TERMS = "Prices are in Malaysian Ringgit. Work starts after the first payment is received. Timelines depend on receiving content and feedback promptly. Changes outside this scope are quoted separately. See our Terms of Service and Refund Policy.";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ lead?: string; ai?: string; client?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const settings = await getBusinessSettings();
  const { data: svc } = await supabase.from("services").select("*").order("sort_order");
  const services = (svc ?? []) as Service[];

  const initial: QuoteEditorValues = {
    client_email: "", client_name: "", lead_id: "", service_id: "", recommended_service_id: "", title: "", summary: "",
    line_items: [], discount_cents: 0, tax_rate: settings.sst_registered ? Number(settings.sst_rate) : 0,
    payment_schedule: [{ label: "Deposit", percent: 50 }, { label: "Final payment on completion", percent: 50 }],
    deliverables: [], exclusions: [], revisions_included: 2, timeline_text: "", valid_until: "", terms: DEFAULT_TERMS,
  };
  let notes: string[] | undefined;

  if (sp.lead && /^[0-9a-f-]{36}$/i.test(sp.lead)) {
    const { data: lead } = await supabase.from("leads").select("*").eq("id", sp.lead).maybeSingle();
    if (lead) {
      Object.assign(initial, { lead_id: lead.id, client_email: lead.email, client_name: lead.name, service_id: lead.service_id ?? "" });
      const s = services.find((x) => x.id === lead.service_id);
      if (s) {
        Object.assign(initial, {
          title: s.name, deliverables: s.deliverables, exclusions: s.exclusions, revisions_included: s.revisions_included, timeline_text: s.timeline_text ?? "",
          line_items: s.price_min_cents ? [{ description: s.name, quantity: 1, unit_price_cents: s.price_min_cents }] : [],
          payment_schedule: s.deposit_percent >= 100 ? [{ label: "Full payment", percent: 100 }] : [{ label: "Deposit", percent: s.deposit_percent }, { label: "Final payment on completion", percent: 100 - s.deposit_percent }],
        });
      }
    }
  } else if (sp.client && /^[0-9a-f-]{36}$/i.test(sp.client)) {
    const { data: c } = await supabase.from("profiles").select("email,full_name").eq("id", sp.client).maybeSingle();
    if (c) Object.assign(initial, { client_email: c.email, client_name: c.full_name ?? "" });
  }

  if (sp.ai && /^[0-9a-f-]{36}$/i.test(sp.ai)) {
    const { data: log } = await supabase.from("ai_logs").select("output,task").eq("id", sp.ai).maybeSingle();
    if (log?.task === "draft_quote" && log.output) {
      try {
        const draft = quoteDraftSchema.parse(JSON.parse(log.output));
        const e = quoteDraftToEditor(draft);
        const s = services.find((x) => x.slug === e.service_slug);
        Object.assign(initial, {
          title: e.title, summary: e.summary, line_items: e.line_items, payment_schedule: e.payment_schedule,
          deliverables: e.deliverables, exclusions: e.exclusions, revisions_included: e.revisions_included,
          timeline_text: e.timeline_text, service_id: s?.id ?? initial.service_id,
        });
        notes = e.notes_for_owner;
      } catch {
        notes = ["The AI draft could not be loaded. Start from the lead details instead."];
      }
    }
  }

  return (
    <>
      <PageHeader title="New quotation" description="Saved as a draft. Nothing is sent until you click “Send to client”." />
      <QuoteEditor initial={initial} services={services} notesForOwner={notes} />
    </>
  );
}
