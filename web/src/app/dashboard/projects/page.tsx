import Link from "next/link";
import { ProgressBar, PROJECT_STATUS_LABEL } from "@/components/app/bits";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatMYR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { Project } from "@/lib/types";

export default async function ProjectsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("client_id", user.id).order("created_at", { ascending: false });
  const projects = (data ?? []) as Project[];
  return (
    <>
      <PageHeader title="Projects" description="Your orders and their progress." />
      {projects.length === 0 ? (
        <EmptyState title="No projects yet" action={<ButtonLink href="/services">Browse services</ButtonLink>}>Accept a quotation or order a package to start a project.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="glass block rounded-2xl p-5 transition hover:border-brand-400/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-fg">{p.name}</p>
                  <p className="text-xs text-subtle">{p.number} · {formatMYR(p.total_cents)}</p>
                </div>
                <StatusBadge status={p.status} label={PROJECT_STATUS_LABEL[p.status]} />
              </div>
              <ProgressBar value={p.progress} className="mt-4" />
              <p className="mt-2 text-xs text-muted">{p.progress}% complete{p.due_date ? ` · target ${formatDate(p.due_date)}` : ""}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
