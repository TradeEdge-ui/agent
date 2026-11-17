"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { saveService } from "@/actions/admin";
import { centsToInput, parseRinggit, priceLabel } from "@/lib/money";
import type { Service } from "@/lib/types";

type Editable = Omit<Service, "id"> & { id?: string };

export const EMPTY_SERVICE: Editable = {
  slug: "", category: "website", name: "", tagline: "", description: "", price_min_cents: null, price_max_cents: null, price_notes: "",
  billing_type: "one_time", purchase_mode: "quote", deposit_percent: 50, deliverables: [], exclusions: [], revisions_included: 2,
  timeline_text: "", is_featured: false, is_active: true, sort_order: 100,
};

function Lines({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-2">
        {value.map((x, i) => (
          <div key={i} className="flex gap-2">
            <Input value={x} onChange={(e) => onChange(value.map((y, j) => (j === i ? e.target.value : y)))} aria-label={`${label} ${i + 1}`} />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">✕</Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...value, ""])}>+ Add</Button>
      </div>
    </div>
  );
}

export function ServiceEditor({ service }: { service: Editable }) {
  const [s, setS] = useState(service);
  const [min, setMin] = useState(centsToInput(service.price_min_cents));
  const [max, setMax] = useState(centsToInput(service.price_max_cents));
  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => setS((p) => ({ ...p, [k]: v }));
  const minC = min.trim() ? parseRinggit(min) : null;
  const maxC = max.trim() ? parseRinggit(max) : null;
  const payload = JSON.stringify({
    ...s,
    price_min_cents: minC,
    price_max_cents: maxC,
    deliverables: s.deliverables.map((x) => x.trim()).filter(Boolean),
    exclusions: s.exclusions.map((x) => x.trim()).filter(Boolean),
  });

  return (
    <ActionForm action={saveService} className="space-y-6">
      {(st) => (
        <>
          <input type="hidden" name="payload" value={payload} />
          <Card className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="name" error={st.fieldErrors?.name}><Input id="name" value={s.name} onChange={(e) => set("name", e.target.value)} required /></Field>
              <Field label="URL slug" htmlFor="slug" error={st.fieldErrors?.slug}><Input id="slug" value={s.slug} onChange={(e) => set("slug", e.target.value)} placeholder="starter-website" required /></Field>
              <Field label="Category" htmlFor="category"><Select id="category" value={s.category} onChange={(e) => set("category", e.target.value as Editable["category"])}><option value="website">Website development</option><option value="ai">AI solutions</option><option value="maintenance">Care plans</option></Select></Field>
              <Field label="Sort order" htmlFor="sort_order"><Input id="sort_order" type="number" value={s.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} /></Field>
            </div>
            <Field label="Tagline" htmlFor="tagline"><Input id="tagline" value={s.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} /></Field>
            <Field label="Description" htmlFor="description"><Textarea id="description" rows={3} value={s.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-semibold text-fg">Pricing</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Billing" htmlFor="billing_type"><Select id="billing_type" value={s.billing_type} onChange={(e) => set("billing_type", e.target.value as Editable["billing_type"])}><option value="one_time">One-time project</option><option value="monthly">Monthly subscription</option></Select></Field>
              <Field label="Min / base price (RM)" htmlFor="min" error={st.fieldErrors?.price_min_cents} hint="Blank = 'Request quotation'"><Input id="min" value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" /></Field>
              <Field label="Max price (RM)" htmlFor="max" error={st.fieldErrors?.price_max_cents} hint="Blank = 'From …'"><Input id="max" value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" /></Field>
              <Field label="Deposit %" htmlFor="deposit"><Input id="deposit" type="number" min={1} max={100} value={s.deposit_percent} onChange={(e) => set("deposit_percent", Number(e.target.value))} /></Field>
            </div>
            <Field label="How customers buy" htmlFor="purchase_mode" hint="'Direct' lets clients pay the base price (or subscribe) online without a quotation.">
              <Select id="purchase_mode" value={s.purchase_mode} onChange={(e) => set("purchase_mode", e.target.value as Editable["purchase_mode"])}><option value="quote">Request a quotation</option><option value="direct">Buy / subscribe online at base price</option></Select>
            </Field>
            <Field label="Pricing notes" htmlFor="price_notes"><Textarea id="price_notes" rows={2} value={s.price_notes ?? ""} onChange={(e) => set("price_notes", e.target.value)} /></Field>
            <p className="text-sm text-muted">Shown as: <span className="font-medium text-fg">{priceLabel({ price_min_cents: minC, price_max_cents: maxC, billing_type: s.billing_type, purchase_mode: s.purchase_mode })}</span></p>
          </Card>
          <Card className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Lines label="Deliverables" value={s.deliverables} onChange={(v) => set("deliverables", v)} />
              <Lines label="Exclusions" value={s.exclusions} onChange={(v) => set("exclusions", v)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Revision rounds" htmlFor="revisions"><Input id="revisions" type="number" min={0} value={s.revisions_included} onChange={(e) => set("revisions_included", Number(e.target.value))} /></Field>
              <Field label="Timeline text" htmlFor="timeline"><Input id="timeline" value={s.timeline_text ?? ""} onChange={(e) => set("timeline_text", e.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-muted"><Checkbox checked={s.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Active (visible on website)</label>
              <label className="flex items-center gap-2 text-sm text-muted"><Checkbox checked={s.is_featured} onChange={(e) => set("is_featured", e.target.checked)} /> Featured on homepage</label>
            </div>
          </Card>
          <SubmitButton pendingText="Saving…">Save service</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
