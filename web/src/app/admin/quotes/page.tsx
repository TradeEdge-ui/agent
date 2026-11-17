import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatMYR } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export default async function AdminQuotesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("quotes").select("*").order("created_at", { ascending: false }).limit(200);
  const quotes = data ?? [];
  return (
    <>
      <PageHeader title="Quotations" actions={<ButtonLink href="/admin/quotes/new">New quotation</ButtonLink>} />
      {quotes.length === 0 ? <EmptyState title="No quotations yet" /> : (
        <Table>
          <thead><tr><Th>Number</Th><Th>Client</Th><Th>Title</Th><Th>Total</Th><Th>Sent</Th><Th>Valid until</Th><Th>Status</Th></tr></thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <Td><Link className="text-brand-300" href={`/admin/quotes/${q.id}`}>{q.number}</Link></Td>
                <Td>{q.client_name ?? q.client_email}</Td>
                <Td className="text-fg">{q.title}</Td>
                <Td className="tabular-nums">{formatMYR(q.total_cents)}</Td>
                <Td>{formatDate(q.sent_at)}</Td>
                <Td>{formatDate(q.valid_until)}</Td>
                <Td><StatusBadge status={q.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
