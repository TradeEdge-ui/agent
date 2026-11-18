import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessHeader, LineItemsTable } from "@/components/app/documents";
import { SearchParamAlerts } from "@/components/app/bits";
import { Card, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox, Textarea } from "@/components/ui/form";
import { IconCheck, IconX } from "@/components/icons";
import { acceptQuote, declineQuote } from "@/actions/client";
import { createClient } from "@/lib/supabase/server";
import { getBusinessSettings } from "@/lib/settings";
import { formatMYR } from "@/lib/money";
import { formatDate, todayMY } from "@/lib/dates";
import { splitByPercent } from "@/lib/invoice-math";
import type { Quote } from "@/lib/types";

export default async function QuoteDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const q = data as Quote;
  const settings = await getBusinessSettings();
  const expired = q.valid_until != null && q.valid_until < todayMY();
  const amounts = splitByPercent(q.total_cents, q.payment_schedule);

  return (
    <>
      <SearchParamAlerts messages={[{ when: Boolean(sp.error), tone: "danger", text: sp.error === "agree" ? "Please tick the box to confirm you accept the quotation and terms." : sp.error }]} />
      <PageHeader title={`Quotation ${q.number}`} description={q.title} actions={<StatusBadge status={expired && q.status === "sent" ? "expired" : q.status} />} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="print-surface space-y-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row">
            <BusinessHeader settings={settings} />
            <div className="text-sm text-muted sm:text-right">
              <p>Prepared for <span className="text-fg">{q.client_name ?? q.client_email}</span></p>
              <p>Date: {formatDate(q.sent_at ?? q.created_at)}</p>
              <p>Valid until: {formatDate(q.valid_until)}</p>
            </div>
          </div>
          {q.summary && <p className="whitespace-pre-line leading-relaxed text-muted">{q.summary}</p>}
          <LineItemsTable items={q.line_items} subtotal={q.subtotal_cents} discount={q.discount_cents} taxRate={q.tax_rate} tax={q.tax_cents} total={q.total_cents} />
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold text-fg">Deliverables</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">{q.deliverables.map((d) => <li key={d} className="flex gap-2"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{d}</li>)}</ul>
            </div>
            <div>
              <h3 className="font-semibold text-fg">Not included</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">{q.exclusions.map((d) => <li key={d} className="flex gap-2"><IconX className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />{d}</li>)}</ul>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 text-sm">
            <div>
              <h3 className="font-semibold text-fg">Payment schedule</h3>
              <ul className="mt-3 space-y-1.5 text-muted">
                {q.payment_schedule.map((s, i) => <li key={i} className="flex justify-between gap-3"><span>{s.label} ({s.percent}%)</span><span className="tabular-nums text-fg">{formatMYR(amounts[i])}</span></li>)}
              </ul>
            </div>
            <div className="text-muted">
              <h3 className="font-semibold text-fg">Timeline & revisions</h3>
              <p className="mt-3">{q.timeline_text ?? "To be confirmed at kick-off"}</p>
              <p className="mt-1">{q.revisions_included} revision round{q.revisions_included === 1 ? "" : "s"} included</p>
            </div>
          </div>
          {q.terms && <div><h3 className="font-semibold text-fg">Terms</h3><p className="mt-2 whitespace-pre-line text-sm text-muted">{q.terms}</p></div>}
        </Card>

        <div className="no-print space-y-4">
          {q.status === "sent" && !expired && (
            <Card>
              <h2 className="font-semibold text-fg">Accept this quotation</h2>
              <p className="mt-2 text-sm text-muted">Accepting creates your project and the first invoice ({formatMYR(amounts[0])}). Work begins once it is paid.</p>
              <form action={acceptQuote} className="mt-4 space-y-4">
                <input type="hidden" name="quote_id" value={q.id} />
                <label className="flex items-start gap-3 text-sm text-muted">
                  <Checkbox name="agree" required />
                  <span>I accept this quotation and the <Link className="text-brand-300 underline" href="/legal/terms" target="_blank">Terms</Link> and <Link className="text-brand-300 underline" href="/legal/refund" target="_blank">Refund Policy</Link>.</span>
                </label>
                <Button type="submit" className="w-full">Accept & continue to payment</Button>
              </form>
              <details className="mt-5 border-t border-white/10 pt-4">
                <summary className="cursor-pointer text-sm text-muted">Decline or request changes</summary>
                <form action={declineQuote} className="mt-3 space-y-3">
                  <input type="hidden" name="quote_id" value={q.id} />
                  <Textarea name="reason" rows={3} placeholder="Let us know what you'd like changed (optional)" aria-label="Reason" />
                  <Button type="submit" variant="secondary" size="sm">Decline quotation</Button>
                </form>
              </details>
            </Card>
          )}
          {q.status === "sent" && expired && <Card><p className="text-sm text-muted">This quotation has expired. Please <Link href="/contact" className="text-brand-300">contact us</Link> for an updated one.</p></Card>}
          {q.status === "accepted" && q.project_id && (
            <Card><p className="text-sm text-muted">Accepted on {formatDate(q.accepted_at)}.</p><Link href={`/dashboard/projects/${q.project_id}`} className="mt-3 inline-block text-sm text-brand-300">View project →</Link></Card>
          )}
          <Card><p className="text-sm text-muted">Questions about this quotation? Reply to our email or <Link href="/book" className="text-brand-300">book a call</Link>.</p></Card>
        </div>
      </div>
    </>
  );
}
