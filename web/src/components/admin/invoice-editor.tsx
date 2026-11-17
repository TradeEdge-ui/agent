"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { createManualInvoice } from "@/actions/admin";
import { computeTotals } from "@/lib/invoice-math";
import { formatMYR, parseRinggit } from "@/lib/money";

type Row = { description: string; quantity: string; price: string };

export function InvoiceEditor({ clients, projects, defaultClient, defaultTaxRate }: {
  clients: { id: string; label: string }[];
  projects: { id: string; name: string; client_id: string }[];
  defaultClient?: string;
  defaultTaxRate: number;
}) {
  const [clientId, setClientId] = useState(defaultClient ?? "");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Row[]>([{ description: "", quantity: "1", price: "" }]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState(defaultTaxRate);
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [issue, setIssue] = useState(true);
  const items = rows.filter((r) => r.description.trim()).map((r) => ({ description: r.description.trim(), quantity: Number(r.quantity) || 0, unit_price_cents: parseRinggit(r.price) ?? 0 }));
  const totals = computeTotals(items, parseRinggit(discount) ?? 0, tax);
  const payload = JSON.stringify({ client_id: clientId, project_id: projectId, title, line_items: items, discount_cents: totals.discount_cents, tax_rate: tax, due_date: due, notes, issue_now: issue });

  return (
    <ActionForm action={createManualInvoice} className="space-y-6">
      {(s) => (
        <>
          <input type="hidden" name="payload" value={payload} />
          <Card className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client *" htmlFor="client" error={s.fieldErrors?.client_id}>
                <Select id="client" value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId(""); }}><option value="">Choose…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
              </Field>
              <Field label="Project" htmlFor="project">
                <Select id="project" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">None</option>{projects.filter((p) => p.client_id === clientId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
              </Field>
            </div>
            <Field label="Title *" htmlFor="title" error={s.fieldErrors?.title}><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="E.g. Additional pages (change request)" /></Field>
          </Card>
          <Card className="space-y-3">
            {s.fieldErrors?.line_items && <p className="text-xs text-red-300">{s.fieldErrors.line_items}</p>}
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px] gap-2 sm:grid-cols-[1fr_80px_140px_40px]">
                <Input className="col-span-2 sm:col-span-1" value={r.description} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Description" aria-label="Description" />
                <Input value={r.quantity} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} aria-label="Quantity" inputMode="decimal" />
                <Input value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} placeholder="0.00" aria-label="Unit price (RM)" inputMode="decimal" />
                <Button type="button" variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove">✕</Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setRows([...rows, { description: "", quantity: "1", price: "" }])}>+ Line item</Button>
            <div className="grid gap-4 pt-2 sm:grid-cols-3">
              <Field label="Discount (RM)" htmlFor="discount"><Input id="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" /></Field>
              <Field label="SST %" htmlFor="tax"><Input id="tax" type="number" min={0} max={100} step="0.01" value={tax} onChange={(e) => setTax(Number(e.target.value))} /></Field>
              <Field label="Due date" htmlFor="due" hint="Blank = default terms"><Input id="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
            </div>
            <p className="text-right text-lg font-semibold text-fg">Total {formatMYR(totals.total_cents)}</p>
          </Card>
          <Card className="space-y-4">
            <Field label="Notes (shown on invoice)" htmlFor="notes"><Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm text-muted"><Checkbox checked={issue} onChange={(e) => setIssue(e.target.checked)} /> Issue immediately and notify the client</label>
          </Card>
          <SubmitButton pendingText="Creating…">Create invoice</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
