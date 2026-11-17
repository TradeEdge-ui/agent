import type { Metadata } from "next";
import { Container, PageHero } from "@/components/marketing/sections";
import { Card } from "@/components/ui/primitives";
import { BookingForm } from "@/components/forms/booking-form";
import { IconCheck } from "@/components/icons";
import { getBusinessSettings } from "@/lib/settings";
import { generateSlots } from "@/lib/booking";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { env, isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a Free Consultation",
  description: "Book a free 30-minute video consultation about your website, AI chatbot or automation project.",
  alternates: { canonical: "/book" },
};

export default async function BookPage() {
  const settings = await getBusinessSettings();
  let taken: string[] = [];
  if (isSupabaseConfigured() && env.supabaseSecretKey) {
    // Only start times are read (no personal data) to hide booked slots.
    const { data } = await createAdminClient()
      .from("bookings")
      .select("start_at")
      .eq("status", "confirmed")
      .gte("start_at", new Date().toISOString());
    taken = (data ?? []).map((b) => b.start_at);
  }
  const slots = generateSlots(settings.booking_config, taken);
  const user = await getCurrentUser();

  return (
    <>
      <PageHero eyebrow="Free consultation" title="Book a free 30-minute call" description="Talk through your idea, get honest advice on what you need (and what you don't), and a ballpark price. No obligation." />
      <section className="pb-20">
        <Container className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <Card className="p-6 sm:p-8">
            <BookingForm
              slots={slots}
              defaults={user ? { name: user.profile.full_name ?? "", email: user.email, phone: user.profile.phone ?? "" } : undefined}
            />
          </Card>
          <Card className="h-fit">
            <h2 className="font-semibold text-fg">On the call we&apos;ll</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-muted">
              {["Understand your business and goals", "Recommend the right package (or tell you if you don't need one)", "Estimate timeline and budget", "Answer anything about AI for your business"].map((t) => (
                <li key={t} className="flex gap-2.5"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{t}</li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-subtle">Calls are held online (Google Meet or Zoom). We&apos;ll email the link after booking.</p>
          </Card>
        </Container>
      </section>
    </>
  );
}
