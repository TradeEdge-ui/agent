import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadUpdateForm } from "@/components/admin/forms";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, DefinitionList, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { formatMYR } from "@/lib/money";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*, services(name,slug)").eq("id", id).maybeSingle();
  if (!lead) notFound();
  const [{ data: insight }, { data: quotes }, { data: bookings }] = await Promise.all([
    supabase.from("lead_insights").select("*").eq("lead_id", id).maybeSingle(),
    supabase.from("quotes").select("id,number,status,total_cents").eq("lead_id", id),
    supabase.from("bookings").select("id,start_at,status").eq("lead_id", id),
  ]);
  const details = (lead.details ?? {}) as Record<string, string | null>;
  const qual = insight?.ai_qualification as { questions_to_ask?: string[]; next_step?: string } | null;

  return (
    <>
      <PageHeader
        title={lead.name}
        description={`${lead.company ? `${lead.company} · ` : ""}${lead.email}${lead.phone ? ` · ${lead.phone}` : ""}`}
        actions={<>
          <StatusBadge status={lead.status} />
          <ButtonLink href={`/admin/quotes/new?lead=${lead.id}`} size="sm">Create quotation</ButtonLink>
          <ButtonLink href={`/admin/ai?task=qualify_lead&type=lead&id=${lead.id}`} size="sm" variant="secondary">Qualify with AI</ButtonLink>
          <ButtonLink href={`/admin/ai?task=draft_quote&type=lead&id=${lead.id}`} size="sm" variant="secondary">AI quote draft</ButtonLink>
        </>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <DefinitionList items={[
              ["Received", formatDateTime(lead.created_at)],
              ["Source", lead.source.replace("_", " ")],
              ["Service", lead.services?.name ?? "Not specified"],
              ["Budget", lead.budget],
              ["Timeline", lead.timeline],
              ["Website", lead.website_url ? <a key="w" className="text-brand-300" href={lead.website_url} target="_blank" rel="noopener noreferrer nofollow">{lead.website_url}</a> : null],
              ["Account", lead.user_id ? <Link key="a" className="text-brand-300" href={`/admin/clients/${lead.user_id}`}>View client</Link> : "Not registered yet"],
            ]} />
          </Card>
          <Card>
            <h2 className="font-semibold text-fg">Requirements</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{lead.message}</p>
            {details.pages_or_features && <><h3 className="mt-5 text-sm font-semibold text-fg">Pages / features</h3><p className="mt-1 whitespace-pre-line text-sm text-muted">{details.pages_or_features}</p></>}
            {details.references && <><h3 className="mt-5 text-sm font-semibold text-fg">References</h3><p className="mt-1 whitespace-pre-line text-sm text-muted">{details.references}</p></>}
          </Card>
          {insight?.ai_summary && (
            <Card>
              <div className="flex items-center gap-3"><h2 className="font-semibold text-fg">AI assessment</h2><Badge tone="warning">advisory</Badge>{insight.ai_score != null && <Badge tone="brand">{insight.ai_score}/100</Badge>}</div>
              <p className="mt-3 text-sm text-muted">{insight.ai_summary}</p>
              {qual?.questions_to_ask?.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">{qual.questions_to_ask.map((x, i) => <li key={i}>{x}</li>)}</ul> : null}
              {qual?.next_step && <p className="mt-3 text-sm text-muted"><strong className="text-fg">Next step:</strong> {qual.next_step}</p>}
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card><h2 className="mb-4 font-semibold text-fg">Manage</h2><LeadUpdateForm leadId={lead.id} status={lead.status} notes={insight?.internal_notes ?? ""} /></Card>
          <Card>
            <h2 className="font-semibold text-fg">Quotations</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(quotes ?? []).map((q) => <li key={q.id} className="flex justify-between"><Link className="text-brand-300" href={`/admin/quotes/${q.id}`}>{q.number}</Link><span className="text-muted">{formatMYR(q.total_cents)} · {q.status}</span></li>)}
              {(quotes ?? []).length === 0 && <li className="text-muted">None yet.</li>}
            </ul>
          </Card>
          {(bookings ?? []).length > 0 && (
            <Card><h2 className="font-semibold text-fg">Consultations</h2><ul className="mt-3 space-y-1 text-sm text-muted">{bookings!.map((b) => <li key={b.id}>{formatDateTime(b.start_at)} · {b.status}</li>)}</ul></Card>
          )}
          <Card>
            <h2 className="font-semibold text-fg">Quick follow-up</h2>
            <p className="mt-2 text-sm text-muted">Draft a personalised email and WhatsApp message with AI, then send it yourself.</p>
            <ButtonLink href={`/admin/ai?task=follow_up&type=lead&id=${lead.id}`} size="sm" variant="secondary" className="mt-3">Draft follow-up</ButtonLink>
            <a className="mt-3 block text-sm text-brand-300" href={`mailto:${lead.email}`}>Email {lead.email}</a>
          </Card>
        </div>
      </div>
    </>
  );
}
