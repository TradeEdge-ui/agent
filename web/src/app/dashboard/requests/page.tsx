import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import type { Lead } from "@/lib/types";

const LABEL: Record<string, string> = { new: "Received", contacted: "In discussion", qualified: "In discussion", proposal_sent: "Quotation sent", won: "Accepted", lost: "Closed" };

export default async function RequestsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  const leads = (data ?? []) as Lead[];
  return (
    <>
      <PageHeader title="Requests" description="Project requests and enquiries you've sent us." actions={<ButtonLink href="/dashboard/requests/new">New request</ButtonLink>} />
      {leads.length === 0 ? (
        <EmptyState title="No requests yet" action={<ButtonLink href="/dashboard/requests/new">Submit your requirements</ButtonLink>}>Tell us what you need and we&apos;ll prepare a quotation.</EmptyState>
      ) : (
        <Table>
          <thead><tr><Th>Date</Th><Th>Request</Th><Th>Status</Th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap">{formatDate(l.created_at)}</Td>
                <Td><p className="line-clamp-2 text-fg">{l.message.split("\n")[0]}</p></Td>
                <Td><StatusBadge status={l.status} label={LABEL[l.status]} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
