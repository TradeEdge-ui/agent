import Link from "next/link";
import { ProgressBar, PROJECT_STATUS_LABEL } from "@/components/app/bits";
import { EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatMYR } from "@/lib/money";
import { formatDate, todayMY } from "@/lib/dates";

export default async function AdminProjectsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*, profiles(full_name,email)").order("created_at", { ascending: false });
  const today = todayMY();
  return (
    <>
      <PageHeader title="Projects" description="Projects are created automatically when a client accepts a quotation or places an online order." />
      {!data?.length ? <EmptyState title="No projects yet" /> : (
        <Table>
          <thead><tr><Th>Project</Th><Th>Client</Th><Th>Value</Th><Th>Progress</Th><Th>Due</Th><Th>Status</Th></tr></thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id}>
                <Td><Link className="text-fg hover:text-brand-300" href={`/admin/projects/${p.id}`}>{p.name}</Link><p className="text-xs text-subtle">{p.number}</p></Td>
                <Td>{p.profiles?.full_name ?? p.profiles?.email}</Td>
                <Td className="tabular-nums">{formatMYR(p.total_cents)}</Td>
                <Td className="w-40"><ProgressBar value={p.progress} /><span className="text-xs">{p.progress}%</span></Td>
                <Td className={p.due_date && p.due_date < today && !["completed", "cancelled"].includes(p.status) ? "text-red-300" : undefined}>{formatDate(p.due_date)}</Td>
                <Td><StatusBadge status={p.status} label={PROJECT_STATUS_LABEL[p.status]} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
