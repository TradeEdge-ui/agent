import Link from "next/link";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { formatMYR } from "@/lib/money";

export default async function ClientsPage() {
  const supabase = await createClient();
  const [{ data: clients }, { data: pays }, { data: subs }] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name,company_name,phone,created_at,role").eq("role", "client").order("created_at", { ascending: false }),
    supabase.from("payments").select("client_id,amount_cents,refunded_cents"),
    supabase.from("subscriptions").select("client_id,status"),
  ]);
  const ltv = new Map<string, number>();
  for (const p of pays ?? []) if (p.client_id) ltv.set(p.client_id, (ltv.get(p.client_id) ?? 0) + p.amount_cents - p.refunded_cents);
  const activeSubs = new Set((subs ?? []).filter((s) => s.status === "active").map((s) => s.client_id));
  return (
    <>
      <PageHeader title="Clients" description="Registered client accounts." />
      {(clients ?? []).length === 0 ? <EmptyState title="No clients yet">Clients appear here after they create an account.</EmptyState> : (
        <Table>
          <thead><tr><Th>Client</Th><Th>Company</Th><Th>Phone</Th><Th>Joined</Th><Th>Paid to date</Th><Th>Care plan</Th></tr></thead>
          <tbody>
            {clients!.map((c) => (
              <tr key={c.id}>
                <Td><Link className="text-fg hover:text-brand-300" href={`/admin/clients/${c.id}`}>{c.full_name ?? c.email}</Link><p className="text-xs text-subtle">{c.email}</p></Td>
                <Td>{c.company_name ?? "—"}</Td>
                <Td>{c.phone ?? "—"}</Td>
                <Td>{formatDate(c.created_at)}</Td>
                <Td className="tabular-nums">{formatMYR(ltv.get(c.id) ?? 0)}</Td>
                <Td>{activeSubs.has(c.id) ? "Active" : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
