import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Badge, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { priceLabel } from "@/lib/money";
import { CATEGORY_LABELS } from "@/lib/catalog";
import type { Service } from "@/lib/types";

export default async function AdminServicesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("*").order("sort_order");
  const services = (data ?? []) as Service[];
  return (
    <>
      <PageHeader title="Services & pricing" description="Edit packages, prices, deliverables and how customers can buy. Changes appear on the website within ~5 minutes." actions={<ButtonLink href="/admin/services/new">New service</ButtonLink>} />
      <Table>
        <thead><tr><Th>Service</Th><Th>Category</Th><Th>Price</Th><Th>Purchase</Th><Th>Status</Th></tr></thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <Td><Link className="text-fg hover:text-brand-300" href={`/admin/services/${s.id}`}>{s.name}</Link><p className="text-xs text-subtle">/{s.slug}</p></Td>
              <Td>{CATEGORY_LABELS[s.category]}</Td>
              <Td className="tabular-nums">{priceLabel(s)}</Td>
              <Td>{s.purchase_mode === "direct" ? (s.billing_type === "monthly" ? "Subscribe online" : `Buy online (${s.deposit_percent}% deposit)`) : "Quotation"}</Td>
              <Td className="space-x-1">{s.is_active ? <Badge tone="success">active</Badge> : <Badge>hidden</Badge>}{s.is_featured && <Badge tone="brand">featured</Badge>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-4 text-xs text-subtle">Price changes apply to new orders, quotations and subscriptions only. Existing subscriptions keep their price unless you change them in Stripe (give clients 30 days&apos; notice).</p>
    </>
  );
}
