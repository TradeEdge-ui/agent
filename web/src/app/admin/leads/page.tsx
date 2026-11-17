import Link from "next/link";
import { ManualLeadForm } from "@/components/admin/forms";
import { Card, EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/cn";

const FILTERS = ["all", "new", "contacted", "qualified", "proposal_sent", "won", "lost"];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("leads").select("*, services(name), lead_insights(ai_score)").order("created_at", { ascending: false }).limit(200);
  if (sp.status && sp.status !== "all") query = query.eq("status", sp.status);
  if (sp.q) {
    const term = sp.q.replace(/[%,()]/g, " ").trim().slice(0, 80);
    if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`);
  }
  const { data } = await query;
  const leads = data ?? [];
  return (
    <>
      <PageHeader title="Leads" description="Enquiries from forms, bookings and your dashboard." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f} href={f === "all" ? "/admin/leads" : `/admin/leads?status=${f}`} className={cn("rounded-full border px-3 py-1 text-xs", (sp.status ?? "all") === f ? "border-brand-400 bg-brand-500/15 text-fg" : "border-white/10 text-muted hover:text-fg")}>
            {f.replace("_", " ")}
          </Link>
        ))}
        <form className="ml-auto"><input name="q" defaultValue={sp.q} placeholder="Search name, email, company" className="h-9 rounded-lg border border-white/10 bg-ink-900 px-3 text-sm text-fg" aria-label="Search leads" /></form>
      </div>
      {leads.length === 0 ? <EmptyState title="No leads found" /> : (
        <Table>
          <thead><tr><Th>Received</Th><Th>Name</Th><Th>Interest</Th><Th>Budget</Th><Th>Source</Th><Th>AI score</Th><Th>Stage</Th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap">{formatDate(l.created_at)}</Td>
                <Td><Link className="text-fg hover:text-brand-300" href={`/admin/leads/${l.id}`}>{l.name}</Link><p className="text-xs text-subtle">{l.company ?? l.email}</p></Td>
                <Td>{l.services?.name ?? "—"}</Td>
                <Td>{l.budget ?? "—"}</Td>
                <Td>{l.source.replace("_", " ")}</Td>
                <Td>{l.lead_insights?.ai_score ?? "—"}</Td>
                <Td><StatusBadge status={l.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Card className="mt-8"><h2 className="mb-4 font-semibold text-fg">Add a lead manually</h2><ManualLeadForm /></Card>
    </>
  );
}
