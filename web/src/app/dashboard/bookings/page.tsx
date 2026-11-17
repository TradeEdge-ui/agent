import { SearchParamAlerts } from "@/components/app/bits";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { cancelMyBooking } from "@/actions/client";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatDateTime, isFuture } from "@/lib/dates";
import type { Booking } from "@/lib/types";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ error?: string; cancelled?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select("*").eq("user_id", user.id).order("start_at", { ascending: false });
  const bookings = (data ?? []) as Booking[];
  return (
    <>
      <SearchParamAlerts messages={[{ when: Boolean(sp.error), tone: "danger", text: sp.error }, { when: sp.cancelled === "1", tone: "success", text: "Consultation cancelled." }]} />
      <PageHeader title="Consultations" description="Your booked calls with us." actions={<ButtonLink href="/book">Book a consultation</ButtonLink>} />
      {bookings.length === 0 ? <EmptyState title="No consultations booked" /> : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Card key={b.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2"><p className="font-medium text-fg">{formatDateTime(b.start_at)}</p><StatusBadge status={b.status} /></div>
                <p className="text-sm text-muted">{b.topic}</p>
                {b.meeting_url && b.status === "confirmed" && <a className="text-sm text-brand-300" href={b.meeting_url} target="_blank" rel="noopener noreferrer">Join video call →</a>}
              </div>
              {b.status === "confirmed" && isFuture(b.start_at) && (
                <form action={cancelMyBooking}>
                  <input type="hidden" name="booking_id" value={b.id} />
                  <Button type="submit" variant="ghost" size="sm">Cancel</Button>
                </form>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
