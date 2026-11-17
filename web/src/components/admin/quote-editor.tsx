"use client";

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Alert, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { saveQuote } from "@/actions/admin";
import { computeTotals, scheduleIsValid, splitByPercent } from "@/lib/invoice-math";
import { centsToInput, formatMYR, parseRinggit } from "@/lib/money";
import type { LineItem, ScheduleItem, Service } from "@/lib/types";

export type QuoteEditorValues = {
  id?: string;
  client_email: string;
  client_name: string;
  lead_id: string;
  service_id: string;
  recommended_service_id: string;
  title: string;
  summary: string;
  line_items: LineItem[];
  discount_cents: number;
  tax_rate: number;
  payment_schedule: ScheduleItem[];
  deliverables: string[];
  exclusions: string[];
  revisions_included: number;
  timeline_text: string;
  valid_until: string;
  terms: string;
};

type Row = { description: string; quantity: string; price: string };

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <Input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`${label} ${i + 1}`} />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove">✕</Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...items, ""])}>+ Add</Button>
        {items.length === 0 && <p className="text-xs text-subtle">{placeholder}</p>}
      </div>
    </div>
  );
}

export function QuoteEditor({ initial, services, notesForOwner }: { initial: QuoteEditorValues; services: Service[]; notesForOwner?: string[] }) {
  const [v, setV] = useState(initial);
  const [rows, setRows] = useState<Row[]>(
    initial.line_items.length
      ? initial.line_items.map((l) => ({ description: l.description, quantity: String(l.quantity), price: centsToInput(l.unit_price_cents) }))
      : [{ description: "", quantity: "1", price: "" }],
  );
  const [discount, setDiscount] = useState(centsToInput(initial.discount_cents) || "0.00");
  const set = <K extends keyof QuoteEditorValues>(k: K, val: QuoteEditorValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const lineItems: LineItem[] = rows
    .filter((r) => r.description.trim())
    .map((r) => ({ description: r.description.trim(), quantity: Number(r.quantity) || 0, unit_price_cents: parseRinggit(r.price) ?? 0 }));
  const discountCents = parseRinggit(discount) ?? 0;
  const totals = useMemo(() => computeTotals(lineItems, discountCents, Number(v.tax_rate) || 0), [lineItems, discountCents, v.tax_rate]);
  const scheduleOk = scheduleIsValid(v.payment_schedule);
  const instalments = splitByPercent(totals.total_cents, v.payment_schedule);

  function applyService(id: string) {
    const s = services.find((x) => x.id === id);
    set("service_id", id);
    if (!s) return;
    setV((p) => ({
      ...p,
      service_id: id,
      title: p.title || s.name,
      deliverables: p.deliverables.length ? p.deliverables : s.deliverables,
      exclusions: p.exclusions.length ? p.exclusions : s.exclusions,
      revisions_included: s.revisions_included,
      timeline_text: p.timeline_text || s.timeline_text || "",
      payment_schedule:
        s.deposit_percent >= 100
          ? [{ label: "Full payment", percent: 100 }]
          : [{ label: "Deposit", percent: s.deposit_percent }, { label: "Final payment on completion", percent: 100 - s.deposit_percent }],
    }));
    if (!rows.some((r) => r.description.trim()) && s.price_min_cents) {
      setRows([{ description: s.name, quantity: "1", price: centsToInput(s.price_min_cents) }]);
    }
  }

  const payload = JSON.stringify({
    ...v,
    line_items: lineItems,
    discount_cents: discountCents,
    deliverables: v.deliverables.map((d) => d.trim()).filter(Boolean),
    exclusions: v.exclusions.map((d) => d.trim()).filter(Boolean),
  });

  return (
    <ActionForm action={saveQuote} className="space-y-6">
      {(state) => (
        <>
          <input type="hidden" name="payload" value={payload} />
          {notesForOwner && notesForOwner.length > 0 && (
            <Alert tone="warning" title="AI draft — check these before sending">
              <ul className="list-disc pl-5">{notesForOwner.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </Alert>
          )}
          <Card className="space-y-4">
            <h2 className="font-semibold text-fg">Client</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client email *" htmlFor="client_email" error={state.fieldErrors?.client_email} hint="The client sees this quote after signing in with this email.">
                <Input id="client_email" type="email" value={v.client_email} onChange={(e) => set("client_email", e.target.value)} required />
              </Field>
              <Field label="Client name" htmlFor="client_name"><Input id="client_name" value={v.client_name} onChange={(e) => set("client_name", e.target.value)} /></Field>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-semibold text-fg">Scope</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Base service" htmlFor="service_id" hint="Fills deliverables, exclusions and payment terms.">
                <Select id="service_id" value={v.service_id} onChange={(e) => applyService(e.target.value)}>
                  <option value="">Custom</option>
                  {services.filter((s) => s.billing_type === "one_time").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Recommend a care plan" htmlFor="recommended_service_id">
                <Select id="recommended_service_id" value={v.recommended_service_id} onChange={(e) => set("recommended_service_id", e.target.value)}>
                  <option value="">None</option>
                  {services.filter((s) => s.billing_type === "monthly").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Title *" htmlFor="title" error={state.fieldErrors?.title}><Input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} required /></Field>
            <Field label="Summary (shown to client)" htmlFor="summary"><Textarea id="summary" rows={4} value={v.summary} onChange={(e) => set("summary", e.target.value)} /></Field>
            <div className="grid gap-6 md:grid-cols-2">
              <ListEditor label="Deliverables" items={v.deliverables} onChange={(x) => set("deliverables", x)} placeholder="What the client receives." />
              <ListEditor label="Exclusions" items={v.exclusions} onChange={(x) => set("exclusions", x)} placeholder="What is not included." />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Revision rounds" htmlFor="rev"><Input id="rev" type="number" min={0} max={20} value={v.revisions_included} onChange={(e) => set("revisions_included", Number(e.target.value))} /></Field>
              <Field label="Timeline" htmlFor="timeline_text"><Input id="timeline_text" value={v.timeline_text} onChange={(e) => set("timeline_text", e.target.value)} placeholder="3–4 weeks after content" /></Field>
              <Field label="Valid until" htmlFor="valid_until" hint="Blank = default validity on send."><Input id="valid_until" type="date" value={v.valid_until} onChange={(e) => set("valid_until", e.target.value)} /></Field>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-semibold text-fg">Pricing (RM)</h2>
            {state.fieldErrors?.line_items && <p className="text-xs text-red-300">{state.fieldErrors.line_items}</p>}
            <div className="space-y-2">
              <div className="hidden grid-cols-[1fr_80px_140px_40px] gap-2 text-xs text-subtle sm:grid"><span>Description</span><span>Qty</span><span>Unit price</span><span /></div>
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_70px] gap-2 sm:grid-cols-[1fr_80px_140px_40px]">
                  <Input value={r.description} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Description" aria-label="Line description" className="col-span-2 sm:col-span-1" />
                  <Input value={r.quantity} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} inputMode="decimal" aria-label="Quantity" />
                  <Input value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} inputMode="decimal" placeholder="0.00" aria-label="Unit price" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove line">✕</Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => setRows([...rows, { description: "", quantity: "1", price: "" }])}>+ Line item</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Discount (RM)" htmlFor="discount"><Input id="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" /></Field>
              <Field label="SST %" htmlFor="tax_rate" hint="Leave 0 unless SST-registered."><Input id="tax_rate" type="number" step="0.01" min={0} max={100} value={v.tax_rate} onChange={(e) => set("tax_rate", Number(e.target.value))} /></Field>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
                <p className="flex justify-between text-muted"><span>Subtotal</span><span className="tabular-nums">{formatMYR(totals.subtotal_cents)}</span></p>
                {totals.discount_cents > 0 && <p className="flex justify-between text-muted"><span>Discount</span><span className="tabular-nums">−{formatMYR(totals.discount_cents)}</span></p>}
                {totals.tax_cents > 0 && <p className="flex justify-between text-muted"><span>SST</span><span className="tabular-nums">{formatMYR(totals.tax_cents)}</span></p>}
                <p className="mt-1 flex justify-between font-semibold text-fg"><span>Total</span><span className="tabular-nums">{formatMYR(totals.total_cents)}</span></p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-semibold text-fg">Payment schedule</h2>
            {state.fieldErrors?.payment_schedule && <p className="text-xs text-red-300">{state.fieldErrors.payment_schedule}</p>}
            {v.payment_schedule.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_110px_40px] items-center gap-2">
                <Input value={s.label} onChange={(e) => set("payment_schedule", v.payment_schedule.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Instalment label" />
                <Input type="number" min={1} max={100} value={s.percent} onChange={(e) => set("payment_schedule", v.payment_schedule.map((x, j) => (j === i ? { ...x, percent: Number(e.target.value) } : x)))} aria-label="Percent" />
                <span className="text-right text-sm tabular-nums text-muted">{formatMYR(instalments[i] ?? 0)}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => set("payment_schedule", v.payment_schedule.filter((_, j) => j !== i))} aria-label="Remove instalment">✕</Button>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => set("payment_schedule", [...v.payment_schedule, { label: "Milestone", percent: 0 }])}>+ Instalment</Button>
              <span className={scheduleOk ? "text-xs text-emerald-300" : "text-xs text-amber-300"}>
                Total {v.payment_schedule.reduce((a, s) => a + (Number(s.percent) || 0), 0)}% {scheduleOk ? "✓" : "(must be 100%)"}
              </span>
            </div>
            <p className="text-xs text-subtle">The first instalment is invoiced automatically when the client accepts. Later instalments are created as drafts you issue at each milestone.</p>
          </Card>

          <Card>
            <Field label="Terms & notes (shown to client)" htmlFor="terms"><Textarea id="terms" rows={4} value={v.terms} onChange={(e) => set("terms", e.target.value)} /></Field>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingText="Saving…">{v.id ? "Save draft" : "Create draft"}</SubmitButton>
            <p className="text-xs text-subtle">Saving never sends anything. You review and click “Send to client” separately.</p>
          </div>
        </>
      )}
    </ActionForm>
  );
}
