import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/marketing/sections";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/primitives";
import { Checkbox, Label, Select, Textarea } from "@/components/ui/form";
import { IconCheck, IconLock, IconX } from "@/components/icons";
import { placeDirectOrder, startSubscription } from "@/actions/client";
import { getServiceBySlug } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/settings";
import { isStripeConfigured } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { formatMYR } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();
  if (service.purchase_mode !== "direct" || !service.price_min_cents) redirect(`/get-quote?service=${slug}`);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/order/${slug}`)}`);

  const settings = await getBusinessSettings();
  const monthly = service.billing_type === "monthly";
  const base = service.price_min_cents;
  const tax = settings.sst_registered ? Math.round((base * Number(settings.sst_rate)) / 100) : 0;
  const total = base + tax;
  const deposit = service.deposit_percent >= 100 ? total : Math.round((total * service.deposit_percent) / 100);
  const stripeOn = isStripeConfigured();
  let projects: { id: string; name: string }[] = [];
  if (monthly) {
    const supabase = await createClient();
    const { data } = await supabase.from("projects").select("id,name").eq("client_id", user.id).not("status", "in", "(cancelled)");
    projects = data ?? [];
  }
  const errorText = sp.error === "agree" ? "Please tick the box to accept the terms." : sp.error;

  return (
    <section className="py-14">
      <Container className="max-w-4xl">
        <h1 className="text-3xl font-semibold text-fg">{monthly ? "Subscribe" : "Order"}: {service.name}</h1>
        <p className="mt-2 text-muted">{service.tagline}</p>
        {errorText && <Alert tone="danger" className="mt-6">{errorText}</Alert>}
        {monthly && !stripeOn && <Alert tone="warning" className="mt-6">Online subscriptions are not available yet. Please <Link className="underline" href="/contact">contact us</Link> to start this plan.</Alert>}
        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card>
            <h2 className="font-semibold text-fg">What you get</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-muted">{service.deliverables.map((d) => <li key={d} className="flex gap-2.5"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{d}</li>)}</ul>
            <h3 className="mt-6 font-semibold text-fg">Not included</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">{service.exclusions.map((d) => <li key={d} className="flex gap-2.5"><IconX className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />{d}</li>)}</ul>
            {service.price_notes && <p className="mt-5 text-sm text-muted">{service.price_notes}</p>}
          </Card>
          <Card className="glow-border h-fit">
            <h2 className="font-semibold text-fg">Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">{monthly ? "Monthly price" : "Package price"}</dt><dd className="tabular-nums text-fg">{formatMYR(base)}</dd></div>
              {tax > 0 && <div className="flex justify-between"><dt className="text-muted">SST ({Number(settings.sst_rate)}%)</dt><dd className="tabular-nums text-fg">{formatMYR(tax)}</dd></div>}
              {!monthly && service.deposit_percent < 100 && (
                <>
                  <div className="flex justify-between"><dt className="text-muted">Total</dt><dd className="tabular-nums text-fg">{formatMYR(total)}</dd></div>
                  <div className="flex justify-between border-t border-white/10 pt-2"><dt className="font-medium text-fg">Pay today ({service.deposit_percent}% deposit)</dt><dd className="font-semibold tabular-nums text-fg">{formatMYR(deposit)}</dd></div>
                  <p className="text-xs text-subtle">Balance of {formatMYR(total - deposit)} is invoiced on completion.</p>
                </>
              )}
              {monthly && <p className="pt-2 text-xs text-subtle">Billed monthly by card. Cancel anytime; your plan runs until the end of the paid month.</p>}
            </dl>
            <form action={monthly ? startSubscription : placeDirectOrder} className="mt-6 space-y-4">
              <input type="hidden" name="slug" value={service.slug} />
              {!monthly && (
                <div>
                  <Label htmlFor="notes">Tell us about your business (optional)</Label>
                  <Textarea id="notes" name="notes" rows={3} placeholder="Business name, what you sell, pages you need…" />
                </div>
              )}
              {monthly && projects.length > 0 && (
                <div>
                  <Label htmlFor="project_id">Website to maintain</Label>
                  <Select id="project_id" name="project_id" defaultValue=""><option value="">Not built by ARyzz / other</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
                </div>
              )}
              <label className="flex items-start gap-3 text-sm text-muted">
                <Checkbox name="agree" required />
                <span>I agree to the <Link className="text-brand-300 underline" href="/legal/terms" target="_blank">Terms</Link> and <Link className="text-brand-300 underline" href="/legal/refund" target="_blank">Refund Policy</Link>{monthly ? ", and authorise monthly charges until I cancel" : ""}.</span>
              </label>
              <Button type="submit" size="lg" className="w-full" disabled={monthly && !stripeOn}>
                {monthly ? "Continue to secure payment" : stripeOn ? `Pay ${formatMYR(deposit)} deposit` : "Place order"}
              </Button>
            </form>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-subtle"><IconLock className="h-3.5 w-3.5" /> Payments by Stripe — card{monthly ? "" : " or FPX"}.</p>
            <ButtonLink href={`/get-quote?service=${service.slug}`} variant="ghost" size="sm" className="mt-3 w-full">Need something custom? Request a quote</ButtonLink>
          </Card>
        </div>
      </Container>
    </section>
  );
}
