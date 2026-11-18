import Link from "next/link";
import { EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatMYR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { Quote } from "@/lib/types";

export default async function QuotesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("quotes").select("*").eq("client_id", user.id).neq("status", "draft").order("created_at", { ascending: false });
  const quotes = (data ?? []) as Quote[];
  return (
    <>
      <PageHeader title="Quotations" description="Review, accept or decline quotations we've prepared for you." />
      {quotes.length === 0 ? (
        <EmptyState title="No quotations yet" action={<ButtonLink href="/dashboard/requests/new" variant="secondary">Request a quotation</ButtonLink>}>
          When we prepare a quotation for you it will appear here.
        </EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>Number</Th><Th>Title</Th><Th>Total</Th><Th>Valid until</Th><Th>Status</Th></tr></thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <Td><Link className="text-brand-300 hover:text-brand-200" href={`/dashboard/quotes/${q.id}`}>{q.number}</Link></Td>
                <Td className="text-fg">{q.title}</Td>
                <Td className="tabular-nums">{formatMYR(q.total_cents)}</Td>
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
