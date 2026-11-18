import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgressBar, PROJECT_STATUS_LABEL, SectionTitle } from "@/components/app/bits";
import { FileUpload } from "@/components/app/file-upload";
import { ProjectMessageForm, RevisionForm } from "@/components/forms/client-forms";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, DefinitionList, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { IconCheck, IconClock, IconFile } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMYR } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { amountDue } from "@/lib/invoice-math";
import type { FileRecord, Invoice, Milestone, Project, ProjectUpdate, RevisionRequest } from "@/lib/types";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = data as Project;
  const [m, u, r, f, i] = await Promise.all([
    supabase.from("milestones").select("*").eq("project_id", id).order("sort_order"),
    supabase.from("project_updates").select("*, profiles(full_name, role)").eq("project_id", id).order("created_at", { ascending: false }).limit(50),
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
  const remaining = p.revisions_included - used;
  const active = ["planning", "in_progress", "review"].includes(p.status);
  const openInvoice = invoices.find((x) => x.status === "open");

  return (
    <>
      <PageHeader title={p.name} description={`${p.number} · ${formatMYR(p.total_cents)}`} actions={<StatusBadge status={p.status} label={PROJECT_STATUS_LABEL[p.status]} />} />
      {p.status === "awaiting_payment" && openInvoice && (
        <Alert tone="warning" className="mb-6" title="Waiting for your deposit">
          Your project starts as soon as invoice {openInvoice.number} ({formatMYR(amountDue(openInvoice))}) is paid.{" "}
          <Link className="underline" href={`/dashboard/invoices/${openInvoice.id}`}>Pay now</Link>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between text-sm"><span className="text-muted">Progress</span><span className="font-medium text-fg">{p.progress}%</span></div>
            <ProgressBar value={p.progress} className="mt-2" />
            <div className="mt-5">
              <DefinitionList items={[
                ["Started", formatDate(p.start_date)],
                ["Target date", p.due_date ? formatDate(p.due_date) : "To be confirmed"],
                ["Revisions", `${Math.max(0, remaining)} of ${p.revisions_included} rounds remaining`],
                ...(p.staging_url ? [["Preview", <a key="s" href={p.staging_url} className="text-brand-300" target="_blank" rel="noopener noreferrer">{p.staging_url}</a>] as [string, React.ReactNode]] : []),
                ...(p.live_url ? [["Live site", <a key="l" href={p.live_url} className="text-brand-300" target="_blank" rel="noopener noreferrer">{p.live_url}</a>] as [string, React.ReactNode]] : []),
              ]} />
            </div>
          </Card>

          <Card>
            <SectionTitle>Milestones</SectionTitle>
            {milestones.length === 0 ? <p className="text-sm text-muted">Milestones will appear here once planning is complete.</p> : (
              <ol className="space-y-3">
                {milestones.map((ms) => (
                  <li key={ms.id} className="flex gap-3">
                    <span className={ms.status === "completed" ? "text-emerald-400" : ms.status === "in_progress" ? "text-brand-300" : "text-subtle"}>
                      {ms.status === "completed" ? <IconCheck className="h-5 w-5" /> : <IconClock className="h-5 w-5" />}
                    </span>
                    <div>
                      <p className="font-medium text-fg">{ms.title}</p>
                      {ms.description && <p className="text-sm text-muted">{ms.description}</p>}
                      <p className="text-xs text-subtle">{ms.status.replace("_", " ")}{ms.due_date ? ` · target ${formatDate(ms.due_date)}` : ""}{ms.completed_at ? ` · done ${formatDate(ms.completed_at)}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <SectionTitle>Updates & messages</SectionTitle>
            <ProjectMessageForm projectId={p.id} />
            <ul className="mt-6 space-y-4">
              {updates.map((x) => (
                <li key={x.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-xs text-subtle">{x.profiles?.role === "admin" ? "ARyzz team" : x.author_id === user.id ? "You" : x.profiles?.full_name ?? "Client"} · {formatDateTime(x.created_at)}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-fg">{x.body}</p>
                </li>
              ))}
              {updates.length === 0 && <li className="text-sm text-muted">No updates yet.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionTitle>Payments</SectionTitle>
            <ul className="space-y-3 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3">
                  <div>
                    <Link href={`/dashboard/invoices/${inv.id}`} className="text-fg hover:text-brand-300">{inv.number}</Link>
                    <p className="text-xs text-subtle">{inv.title.split(" — ").pop()}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-fg">{formatMYR(inv.total_cents)}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </li>
              ))}
              {invoices.length === 0 && <li className="text-muted">No invoices issued yet.</li>}
            </ul>
          </Card>

          <Card>
            <SectionTitle>Files</SectionTitle>
            <FileUpload userId={user.id} projectId={p.id} />
            <ul className="mt-4 space-y-2 text-sm">
              {files.map((file) => (
                <li key={file.id} className="flex items-center gap-2">
                  <IconFile className="h-4 w-4 shrink-0 text-subtle" />
                  <a href={`/api/files/${file.id}`} className="truncate text-fg hover:text-brand-300">{file.filename}</a>
                  {file.kind === "deliverable" && <StatusBadge status="done" label="deliverable" />}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionTitle>Revision requests</SectionTitle>
            {active ? <RevisionForm projectId={p.id} remaining={remaining} /> : <p className="text-sm text-muted">Revision requests open once your project is underway.</p>}
            <ul className="mt-5 space-y-3">
              {revisions.map((rv) => (
                <li key={rv.id} className="rounded-xl border border-white/[0.06] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2"><p className="font-medium text-fg">{rv.title}</p><StatusBadge status={rv.status} /></div>
                  <p className="mt-1 whitespace-pre-line text-muted">{rv.details}</p>
                  {rv.admin_response && <p className="mt-2 border-l-2 border-brand-400/40 pl-3 text-muted">{rv.admin_response}</p>}
                </li>
              ))}
            </ul>
          </Card>
          {p.status === "completed" && (
            <Card>
              <p className="text-sm text-muted">Happy with the result? A short testimonial helps other businesses find us.</p>
              <ButtonLink href="/dashboard/profile#testimonial" variant="secondary" size="sm" className="mt-3">Leave a testimonial</ButtonLink>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
