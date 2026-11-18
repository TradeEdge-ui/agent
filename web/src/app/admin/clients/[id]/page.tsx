import Link from "next/link";
import { notFound } from "next/navigation";
import { SendNotificationForm } from "@/components/admin/forms";
import { SectionTitle } from "@/components/app/bits";
import { ButtonLink } from "@/components/ui/button";
import { Card, DefinitionList, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { formatMYR } from "@/lib/money";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: projects }, { data: invoices }, { data: subs }, { data: leads }, { data: quotes }] = await Promise.all([
    supabase.from("projects").select("id,number,name,status,total_cents").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("invoices").select("id,number,title,status,total_cents,amount_paid_cents").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("*").eq("client_id", id),
    supabase.from("leads").select("id,message,status,created_at").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("quotes").select("id,number,title,status,total_cents").eq("client_id", id).order("created_at", { ascending: false }),
  ]);
  const paid = (invoices ?? []).reduce((s, i) => s + i.amount_paid_cents, 0);
  return (
    <>
      <PageHeader title={c.full_name ?? c.email} description={c.company_name ?? c.email} actions={<><ButtonLink size="sm" href={`/admin/invoices/new?client=${c.id}`}>New invoice</ButtonLink><ButtonLink size="sm" variant="secondary" href={`/admin/ai?task=upsell&type=client&id=${c.id}`}>Find upsells (AI)</ButtonLink></>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card><DefinitionList items={[["Email", c.email], ["Phone", c.phone], ["Company", c.company_name], ["Joined", formatDate(c.created_at)], ["Paid to date", formatMYR(paid)], ["Stripe customer", c.stripe_customer_id ?? "—"], ["Marketing opt-in", c.marketing_opt_in ? "Yes" : "No"]]} /></Card>
          <Card>
            <SectionTitle>Projects</SectionTitle>
            <ul className="space-y-2 text-sm">{(projects ?? []).map((p) => <li key={p.id} className="flex justify-between gap-2"><Link className="text-brand-300" href={`/admin/projects/${p.id}`}>{p.number} · {p.name}</Link><StatusBadge status={p.status} /></li>)}{!projects?.length && <li className="text-muted">None</li>}</ul>
          </Card>
          <Card>
            <SectionTitle>Invoices</SectionTitle>
            <ul className="space-y-2 text-sm">{(invoices ?? []).map((i) => <li key={i.id} className="flex justify-between gap-2"><Link className="text-brand-300" href={`/admin/invoices/${i.id}`}>{i.number} · {i.title}</Link><span className="flex items-center gap-2 text-muted">{formatMYR(i.total_cents)} <StatusBadge status={i.status} /></span></li>)}{!invoices?.length && <li className="text-muted">None</li>}</ul>
          </Card>
          <Card>
            <SectionTitle>Quotations & requests</SectionTitle>
            <ul className="space-y-2 text-sm">
              {(quotes ?? []).map((q) => <li key={q.id} className="flex justify-between gap-2"><Link className="text-brand-300" href={`/admin/quotes/${q.id}`}>{q.number} · {q.title}</Link><StatusBadge status={q.status} /></li>)}
              {(leads ?? []).map((l) => <li key={l.id} className="flex justify-between gap-2"><Link className="text-brand-300" href={`/admin/leads/${l.id}`}>{l.message.split("\n")[0].slice(0, 60)}</Link><StatusBadge status={l.status} /></li>)}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <SectionTitle>Subscriptions</SectionTitle>
            <ul className="space-y-2 text-sm">{(subs ?? []).map((s) => <li key={s.id} className="flex justify-between"><span className="text-fg">{s.plan_name}</span><StatusBadge status={s.status} /></li>)}{!subs?.length && <li className="text-muted">None</li>}</ul>
          </Card>
          <Card><SectionTitle>Send a notification</SectionTitle><SendNotificationForm clients={[{ id: c.id, label: c.full_name ?? c.email }]} defaultClient={c.id} /></Card>
        </div>
      </div>
    </>
  );
}
