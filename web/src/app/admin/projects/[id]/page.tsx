import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminUpdateForm, DeliverableUpload, MilestoneForm, ProjectEditForm, RevisionResponseForm } from "@/components/admin/forms";
import { ProgressBar, PROJECT_STATUS_LABEL, SectionTitle } from "@/components/app/bits";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { IconFile } from "@/components/icons";
import { setMilestoneStatus } from "@/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatMYR } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { FileRecord, Invoice, Milestone, Project, ProjectUpdate, RevisionRequest } from "@/lib/types";

export default async function AdminProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*, profiles(full_name,email,company_name)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = data as Project & { profiles: { full_name: string | null; email: string; company_name: string | null } | null };
  const [m, u, r, f, i] = await Promise.all([
    supabase.from("milestones").select("*").eq("project_id", id).order("sort_order"),
    supabase.from("project_updates").select("*, profiles(full_name,role)").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("revision_requests").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("files").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("invoices").select("*").eq("project_id", id).order("sequence"),
  ]);
  const milestones = (m.data ?? []) as Milestone[];
  const updates = (u.data ?? []) as (ProjectUpdate & { profiles: { full_name: string | null; role: string } | null })[];
  const revisions = (r.data ?? []) as RevisionRequest[];
  const files = (f.data ?? []) as FileRecord[];
  const invoices = (i.data ?? []) as Invoice[];
  const used = revisions.filter((x) => x.counts_toward_limit && x.status !== "rejected").length;

  return (
    <>
      <PageHeader
        title={p.name}
        description={<>{p.number} · <Link className="text-brand-300" href={`/admin/clients/${p.client_id}`}>{p.profiles?.full_name ?? p.profiles?.email}</Link> · {formatMYR(p.total_cents)}</>}
        actions={<>
          <StatusBadge status={p.status} label={PROJECT_STATUS_LABEL[p.status]} />
          <ButtonLink size="sm" variant="secondary" href={`/admin/ai?task=client_update&type=project&id=${p.id}`}>Draft update (AI)</ButtonLink>
          <ButtonLink size="sm" variant="secondary" href={`/admin/ai?task=project_plan&type=project&id=${p.id}`}>Project plan (AI)</ButtonLink>
        </>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <SectionTitle>Milestones</SectionTitle>
            <ProgressBar value={p.progress} />
            <ol className="mt-4 space-y-3">
              {milestones.map((ms) => (
                <li key={ms.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] p-3">
                  <div>
                    <p className="font-medium text-fg">{ms.title}</p>
                    <p className="text-xs text-subtle">{ms.description}{ms.due_date ? ` · target ${formatDate(ms.due_date)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={ms.status} />
                    {(["pending", "in_progress", "completed"] as const).filter((s) => s !== ms.status).map((s) => (
                      <form key={s} action={setMilestoneStatus}>
                        <input type="hidden" name="milestone_id" value={ms.id} />
                        <input type="hidden" name="project_id" value={p.id} />
                        <input type="hidden" name="status" value={s} />
                        <Button type="submit" size="sm" variant="ghost">{s === "completed" ? "Complete" : s === "in_progress" ? "Start" : "Reset"}</Button>
                      </form>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 border-t border-white/[0.06] pt-5"><MilestoneForm projectId={p.id} /></div>
            <p className="mt-3 text-xs text-subtle">Completing a milestone updates progress and notifies the client. Issue the related instalment invoice from the Payments panel.</p>
          </Card>
          <Card>
            <SectionTitle>Updates & messages</SectionTitle>
            <AdminUpdateForm projectId={p.id} />
            <ul className="mt-6 space-y-3">
              {updates.map((x) => (
                <li key={x.id} className="rounded-xl border border-white/[0.06] p-3">
                  <p className="text-xs text-subtle">{x.profiles?.role === "admin" ? "You" : x.profiles?.full_name ?? "Client"} · {formatDateTime(x.created_at)} {x.is_internal && <Badge tone="warning">internal</Badge>}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-fg">{x.body}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <SectionTitle>Revision requests ({used}/{p.revisions_included} rounds used)</SectionTitle>
            <ul className="space-y-4">
              {revisions.map((rv) => (
                <li key={rv.id} className="rounded-xl border border-white/[0.06] p-3">
                  <div className="flex justify-between gap-2"><p className="font-medium text-fg">{rv.title}</p><StatusBadge status={rv.status} /></div>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted">{rv.details}</p>
                  <RevisionResponseForm revision={rv} projectId={p.id} />
                </li>
              ))}
              {revisions.length === 0 && <li className="text-sm text-muted">No revision requests.</li>}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card><SectionTitle>Project settings</SectionTitle><ProjectEditForm project={p} /></Card>
          <Card>
            <SectionTitle action={<Link className="text-sm text-brand-300" href={`/admin/invoices/new?client=${p.client_id}`}>Extra invoice</Link>}>Payments</SectionTitle>
            <ul className="space-y-3 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2">
                  <Link className="text-fg hover:text-brand-300" href={`/admin/invoices/${inv.id}`}>{inv.number} <span className="text-xs text-subtle">{inv.kind}</span></Link>
                  <span className="flex items-center gap-2 tabular-nums">{formatMYR(inv.total_cents)} <StatusBadge status={inv.status} /></span>
                </li>
              ))}
            </ul>
            {invoices.some((x) => x.status === "draft") && <p className="mt-3 text-xs text-subtle">Draft instalments: open one and click “Issue” when the milestone is reached.</p>}
          </Card>
          <Card>
            <SectionTitle>Files</SectionTitle>
            <DeliverableUpload clientId={p.client_id} projectId={p.id} />
            <ul className="mt-4 space-y-2 text-sm">
              {files.map((file) => (
                <li key={file.id} className="flex items-center gap-2"><IconFile className="h-4 w-4 text-subtle" /><a className="truncate text-fg hover:text-brand-300" href={`/api/files/${file.id}`}>{file.filename}</a><Badge>{file.kind}</Badge></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
