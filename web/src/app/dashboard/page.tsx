import Link from "next/link";
import { ProgressBar, PROJECT_STATUS_LABEL, SearchParamAlerts, SectionTitle } from "@/components/app/bits";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMYR } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { amountDue } from "@/lib/invoice-math";
import type { Invoice, Notification, Project, Quote, Subscription } from "@/lib/types";

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [q, i, p, s, n] = await Promise.all([
    supabase.from("quotes").select("*").eq("client_id", user.id).eq("status", "sent").order("sent_at", { ascending: false }),
    supabase.from("invoices").select("*").eq("client_id", user.id).eq("status", "open").order("due_date"),
    supabase.from("projects").select("*").eq("client_id", user.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("subscriptions").select("*").eq("client_id", user.id).in("status", ["active", "trialing", "past_due"]),
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
  ]);
  const quotes = (q.data ?? []) as Quote[];
  const invoices = (i.data ?? []) as Invoice[];
  const projects = (p.data ?? []) as Project[];
  const subs = (s.data ?? []) as Subscription[];
  const notes = (n.data ?? []) as Notification[];
  const due = invoices.reduce((sum, inv) => sum + amountDue(inv), 0);
  const active = projects.filter((x) => !["completed", "cancelled"].includes(x.status));
  const firstName = (user.profile.full_name ?? "").split(" ")[0];

  return (
    <>
      <SearchParamAlerts messages={[{ when: sp.password === "updated", tone: "success", text: "Your password has been updated." }]} />
      <PageHeader
        title={`Welcome${firstName ? `, ${firstName}` : ""}`}
        description="Everything about your projects, payments and plans — in one place."
        actions={<><ButtonLink href="/dashboard/requests/new">Start a new project</ButtonLink><ButtonLink href="/book" variant="secondary">Book a call</ButtonLink></>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Amount due" value={formatMYR(due)} hint={`${invoices.length} open invoice${invoices.length === 1 ? "" : "s"}`} tone={due > 0 ? "bad" : undefined} />
        <StatCard label="Active projects" value={active.length} />
        <StatCard label="Quotations to review" value={quotes.length} />
        <StatCard label="Care plans" value={subs.length} />
      </div>

      {(quotes.length > 0 || invoices.length > 0) && (
        <section className="mt-10">
          <SectionTitle>Action needed</SectionTitle>
          <div className="space-y-3">
            {quotes.map((x) => (
              <Card key={x.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-fg">Quotation {x.number}: {x.title}</p>
                  <p className="text-sm text-muted">{formatMYR(x.total_cents)} · valid until {formatDate(x.valid_until)}</p>
                </div>
                <ButtonLink href={`/dashboard/quotes/${x.id}`} size="sm">Review quotation</ButtonLink>
              </Card>
            ))}
            {invoices.map((x) => (
              <Card key={x.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-fg">Invoice {x.number}: {x.title}</p>
                  <p className="text-sm text-muted">{formatMYR(amountDue(x))} due {x.due_date ? `by ${formatDate(x.due_date)}` : ""}</p>
                </div>
                <ButtonLink href={`/dashboard/invoices/${x.id}`} size="sm">Pay now</ButtonLink>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionTitle action={<Link href="/dashboard/projects" className="text-sm text-brand-300">View all</Link>}>Your projects</SectionTitle>
          {projects.length === 0 ? (
            <EmptyState title="No projects yet" action={<ButtonLink href="/services" variant="secondary">Browse services</ButtonLink>}>
              Request a quotation or order a package to get started.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {projects.map((x) => (
                <Link key={x.id} href={`/dashboard/projects/${x.id}`} className="glass block rounded-2xl p-4 transition hover:border-brand-400/30">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-fg">{x.name}</p>
                    <StatusBadge status={x.status} label={PROJECT_STATUS_LABEL[x.status]} />
                  </div>
                  <ProgressBar value={x.progress} className="mt-3" />
                  <p className="mt-2 text-xs text-subtle">{x.number} · {x.progress}% complete{x.due_date ? ` · target ${formatDate(x.due_date)}` : ""}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section>
          <SectionTitle action={<Link href="/dashboard/notifications" className="text-sm text-brand-300">All</Link>}>Latest updates</SectionTitle>
          {notes.length === 0 ? (
            <p className="text-sm text-muted">No notifications yet.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((x) => (
                <li key={x.id} className="glass rounded-xl p-3">
                  <Link href={x.link ?? "/dashboard"} className="block">
                    <p className="text-sm font-medium text-fg">{x.title}</p>
                    {x.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{x.body}</p>}
                    <p className="mt-1 text-[11px] text-subtle">{formatDateTime(x.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
