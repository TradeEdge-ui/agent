import Link from "next/link";
import { AiConsole } from "@/components/admin/ai-console";
import { PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { SectionTitle } from "@/components/app/bits";
import { AI_TASKS, type AiContextType } from "@/lib/ai/tasks";
import { isAiConfigured } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { env } from "@/lib/env";

export default async function AdminAiPage({ searchParams }: { searchParams: Promise<{ task?: string; type?: string; id?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [leads, projects, clients, quotes, logs] = await Promise.all([
    supabase.from("leads").select("id,name,company,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("projects").select("id,number,name").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id,email,full_name,company_name").eq("role", "client").limit(200),
    supabase.from("quotes").select("id,number,title").order("created_at", { ascending: false }).limit(100),
    supabase.from("ai_logs").select("id,task,context_ref,model,input_tokens,output_tokens,created_at").order("created_at", { ascending: false }).limit(15),
  ]);
  const options = {
    lead: (leads.data ?? []).map((l) => ({ id: l.id, label: `${l.name}${l.company ? ` (${l.company})` : ""}` })),
    project: (projects.data ?? []).map((p) => ({ id: p.id, label: `${p.number} · ${p.name}` })),
    client: (clients.data ?? []).map((c) => ({ id: c.id, label: `${c.full_name ?? c.email}${c.company_name ? ` (${c.company_name})` : ""}` })),
    quote: (quotes.data ?? []).map((q) => ({ id: q.id, label: `${q.number} · ${q.title}` })),
  };
  const tasks = AI_TASKS.map(({ id, label, description, context, output }) => ({ id, label, description, context, output }));
  const type = ["lead", "project", "client", "quote", "none"].includes(sp.type ?? "") ? (sp.type as AiContextType) : undefined;

  return (
    <>
      <PageHeader title="AI business assistant" description={<>Drafts proposals, plans, follow-ups and analysis using your live data. Model: <code className="text-xs">{env.anthropicModel}</code>. It never acts on its own.</>} />
      <AiConsole tasks={tasks} options={options} initial={{ task: sp.task, type, id: sp.id }} enabled={isAiConfigured()} />
      <div className="mt-10"><SectionTitle>Recent AI usage (audit log)</SectionTitle></div>
      <Table>
        <thead><tr><Th>When</Th><Th>Task</Th><Th>Record</Th><Th>Tokens in / out</Th></tr></thead>
        <tbody>
          {(logs.data ?? []).map((l) => {
            const [kind, rid] = (l.context_ref ?? "").split(":");
            const href = kind === "lead" ? `/admin/leads/${rid}` : kind === "project" ? `/admin/projects/${rid}` : kind === "client" ? `/admin/clients/${rid}` : kind === "quote" ? `/admin/quotes/${rid}` : null;
            return (
              <tr key={l.id}>
                <Td>{formatDateTime(l.created_at)}</Td>
                <Td>{l.task}</Td>
                <Td>{href ? <Link className="text-brand-300" href={href}>{kind}</Link> : "—"}</Td>
                <Td className="tabular-nums">{l.input_tokens ?? "—"} / {l.output_tokens ?? "—"}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
