import Link from "next/link";
import { BookingUpdateForm } from "@/components/admin/forms";
import { SectionTitle } from "@/components/app/bits";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import type { Booking } from "@/lib/types";

export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [up, past] = await Promise.all([
    supabase.from("bookings").select("*").gte("start_at", now).order("start_at"),
    supabase.from("bookings").select("*").lt("start_at", now).order("start_at", { ascending: false }).limit(30),
  ]);
  const render = (list: Booking[]) => list.map((b) => (
    <Card key={b.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-fg">{formatDateTime(b.start_at)}</p>
          <p className="text-sm text-muted">{b.name} · <a className="text-brand-300" href={`mailto:${b.email}`}>{b.email}</a>{b.phone ? ` · ${b.phone}` : ""}{b.company ? ` · ${b.company}` : ""}</p>
          <p className="mt-1 text-sm text-fg">{b.topic}</p>
          {b.notes && <p className="mt-1 whitespace-pre-line text-sm text-muted">{b.notes}</p>}
          {b.lead_id && <Link className="text-xs text-brand-300" href={`/admin/leads/${b.lead_id}`}>View lead →</Link>}
        </div>
        <StatusBadge status={b.status} />
      </div>
      <BookingUpdateForm booking={b} />
    </Card>
  ));
  return (
    <>
      <PageHeader title="Consultations" description="Free consultation bookings. Availability is set in Settings." />
      <SectionTitle>Upcoming</SectionTitle>
      <div className="space-y-4">{(up.data ?? []).length ? render(up.data as Booking[]) : <EmptyState title="No upcoming consultations" />}</div>
      <div className="mt-10"><SectionTitle>Past</SectionTitle></div>
      <div className="space-y-4">{render((past.data ?? []) as Booking[])}</div>
    </>
  );
}
