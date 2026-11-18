import type { ReactNode } from "react";
import { formatMYR } from "@/lib/money";
import type { BusinessSettings, LineItem } from "@/lib/types";

export function LineItemsTable({
  items,
  subtotal,
  discount,
  taxRate,
  tax,
  total,
  extraRows,
}: {
  items: LineItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  extraRows?: Array<[string, ReactNode]>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-subtle">
            <th className="py-2 pr-4 font-medium">Description</th>
            <th className="py-2 pr-4 text-right font-medium">Qty</th>
            <th className="py-2 pr-4 text-right font-medium">Unit price</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-white/[0.05] align-top">
              <td className="py-3 pr-4 text-fg">{it.description}</td>
              <td className="py-3 pr-4 text-right tabular-nums text-muted">{it.quantity}</td>
              <td className="py-3 pr-4 text-right tabular-nums text-muted">{formatMYR(it.unit_price_cents)}</td>
              <td className="py-3 text-right tabular-nums text-fg">{formatMYR(Math.round(it.quantity * it.unit_price_cents))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-sm">
          <tr><td colSpan={3} className="pt-4 pr-4 text-right text-muted">Subtotal</td><td className="pt-4 text-right tabular-nums text-fg">{formatMYR(subtotal)}</td></tr>
          {discount > 0 && <tr><td colSpan={3} className="pt-1 pr-4 text-right text-muted">Discount</td><td className="pt-1 text-right tabular-nums text-fg">−{formatMYR(discount)}</td></tr>}
          {tax > 0 && <tr><td colSpan={3} className="pt-1 pr-4 text-right text-muted">SST ({Number(taxRate)}%)</td><td className="pt-1 text-right tabular-nums text-fg">{formatMYR(tax)}</td></tr>}
          <tr><td colSpan={3} className="pt-2 pr-4 text-right font-semibold text-fg">Total</td><td className="pt-2 text-right text-lg font-semibold tabular-nums text-fg">{formatMYR(total)}</td></tr>
          {extraRows?.map(([k, v]) => (
            <tr key={k}><td colSpan={3} className="pt-1 pr-4 text-right text-muted">{k}</td><td className="pt-1 text-right tabular-nums text-fg">{v}</td></tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}

export function BusinessHeader({ settings }: { settings: BusinessSettings }) {
  return (
    <div className="text-sm text-muted">
      <p className="text-base font-semibold text-fg">{settings.legal_name ?? settings.business_name}</p>
      {settings.registration_no && <p>Reg. no: {settings.registration_no}</p>}
      {settings.sst_registered && settings.sst_number && <p>SST no: {settings.sst_number}</p>}
      {settings.address && <p className="whitespace-pre-line">{settings.address}</p>}
      {settings.email && <p>{settings.email}</p>}
      {settings.phone && <p>{settings.phone}</p>}
    </div>
  );
}

export function BankTransferDetails({ settings, reference }: { settings: BusinessSettings; reference: string }) {
  if (!settings.bank_account_no && !settings.duitnow_id) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
      <p className="font-medium text-fg">Pay by bank transfer / DuitNow</p>
      <dl className="mt-2 grid grid-cols-[140px_minmax(0,1fr)] gap-y-1 text-muted">
        {settings.bank_name && <><dt>Bank</dt><dd className="text-fg">{settings.bank_name}</dd></>}
        {settings.bank_account_name && <><dt>Account name</dt><dd className="text-fg">{settings.bank_account_name}</dd></>}
        {settings.bank_account_no && <><dt>Account no.</dt><dd className="text-fg tabular-nums">{settings.bank_account_no}</dd></>}
        {settings.duitnow_id && <><dt>DuitNow ID</dt><dd className="text-fg">{settings.duitnow_id}</dd></>}
        <dt>Reference</dt><dd className="font-medium text-fg">{reference}</dd>
      </dl>
      <p className="mt-2 text-xs text-subtle">Bank transfers are marked paid once we verify the funds in our account (usually within 1 business day).</p>
    </div>
  );
}
