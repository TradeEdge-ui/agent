import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteEditor } from "@/components/admin/quote-editor";
import { LineItemsTable } from "@/components/app/documents";
import { SearchParamAlerts } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, DefinitionList, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { cancelQuote, duplicateQuote, sendQuote } from "@/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { Quote, Service } from "@/lib/types";

export default async function AdminQuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; sent?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const q = data as Quote;
  const { data: svc } = await supabase.from("services").select("*").order("sort_order");
  const services = (svc ?? []) as Service[];

  return (
    <>
      <SearchParamAlerts messages={[
        { when: sp.saved === "1", tone: "success", text: "Draft created. Review it, then send it to the client." },
        { when: sp.sent === "1", tone: "success", text: "Quotation sent. The client was notified." },
        { when: Boolean(sp.error), tone: "danger", text: sp.error },
      ]} />
      <PageHeader
        title={`Quotation ${q.number}`}
        description={`${q.client_name ?? ""} ${q.client_email}`}
        actions={<>
          <StatusBadge status={q.status} />
          {q.status === "draft" && (
            <form action={sendQuote}><input type="hidden" name="quote_id" value={q.id} /><Button type="submit" size="sm">Send to client</Button></form>
          )}
          <form action={duplicateQuote}><input type="hidden" name="quote_id" value={q.id} /><Button type="submit" size="sm" variant="secondary">Duplicate</Button></form>
          {["draft", "sent"].includes(q.status) && (
            <form action={cancelQuote}><input type="hidden" name="quote_id" value={q.id} /><Button type="submit" size="sm" variant="ghost">Cancel</Button></form>
          )}
        </>}
      />
      {q.status === "draft" ? (
        <QuoteEditor
          services={services}
          initial={{
            id: q.id, client_email: q.client_email, client_name: q.client_name ?? "", lead_id: q.lead_id ?? "", service_id: q.service_id ?? "",
            recommended_service_id: q.recommended_service_id ?? "", title: q.title, summary: q.summary ?? "", line_items: q.line_items,
            discount_cents: q.discount_cents, tax_rate: Number(q.tax_rate), payment_schedule: q.payment_schedule, deliverables: q.deliverables,
            exclusions: q.exclusions, revisions_included: q.revisions_included, timeline_text: q.timeline_text ?? "", valid_until: q.valid_until ?? "", terms: q.terms ?? "",
          }}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card className="space-y-6">
            <h2 className="text-lg font-semibold text-fg">{q.title}</h2>
            {q.summary && <p className="whitespace-pre-line text-sm text-muted">{q.summary}</p>}
            <LineItemsTable items={q.line_items} subtotal={q.subtotal_cents} discount={q.discount_cents} taxRate={q.tax_rate} tax={q.tax_cents} total={q.total_cents} />
          </Card>
          <Card>
            <DefinitionList items={[
              ["Sent", formatDateTime(q.sent_at)],
              ["Valid until", formatDate(q.valid_until)],
              ["Accepted", formatDateTime(q.accepted_at)],
              ["Declined", q.declined_at ? `${formatDateTime(q.declined_at)}${q.decline_reason ? ` — ${q.decline_reason}` : ""}` : null],
              ["Schedule", q.payment_schedule.map((s) => `${s.label} ${s.percent}%`).join(", ")],
              ["Client account", q.client_id ? <Link key="c" className="text-brand-300" href={`/admin/clients/${q.client_id}`}>View</Link> : "Not registered yet"],
              ["Project", q.project_id ? <Link key="p" className="text-brand-300" href={`/admin/projects/${q.project_id}`}>View project</Link> : null],
            ]} />
            {q.status === "sent" && <Link className="mt-4 inline-block text-sm text-brand-300" href={`/admin/ai?task=follow_up&type=quote&id=${q.id}`}>Draft a follow-up with AI →</Link>}
          </Card>
        </div>
      )}
    </>
  );
}
