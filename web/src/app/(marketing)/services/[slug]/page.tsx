import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container, JsonLd, serviceCta } from "@/components/marketing/sections";
import { Reveal } from "@/components/marketing/reveal";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { IconCalendar, IconCheck, IconClock, IconRepeat, IconX } from "@/components/icons";
import { CATEGORY_LABELS, getServiceBySlug, getServices } from "@/lib/catalog";
import { formatMYR, priceLabel } from "@/lib/money";
import { siteConfig } from "@/lib/config";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    return (await getServices()).map((s) => ({ slug: s.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getServiceBySlug(slug);
  if (!s) return { title: "Service not found" };
  return {
    title: `${s.name} — ${priceLabel(s)}`,
    description: s.tagline ?? s.description ?? undefined,
    alternates: { canonical: `/services/${s.slug}` },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getServiceBySlug(slug);
  if (!s) notFound();
  const cta = serviceCta(s);
  const deposit = s.price_min_cents && s.billing_type === "one_time" ? Math.round((s.price_min_cents * s.deposit_percent) / 100) : null;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: s.name,
          description: s.description ?? s.tagline,
          provider: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
          areaServed: "MY",
          ...(s.price_min_cents
            ? { offers: { "@type": "Offer", priceCurrency: "MYR", price: (s.price_min_cents / 100).toFixed(2), url: `${siteConfig.url}/services/${s.slug}` } }
            : {}),
        }}
      />
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <Container className="relative grid gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <Badge tone="brand">{CATEGORY_LABELS[s.category]}</Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-fg sm:text-5xl">{s.name}</h1>
            {s.tagline && <p className="mt-4 text-lg text-muted">{s.tagline}</p>}
            {s.description && <p className="mt-6 leading-relaxed text-muted">{s.description}</p>}
          </div>
          <Card className="glow-border h-fit">
            <p className="text-sm text-subtle">Price</p>
            <p className="mt-1 text-3xl font-semibold text-fg">{priceLabel(s)}</p>
            {s.price_notes && <p className="mt-3 text-sm leading-relaxed text-muted">{s.price_notes}</p>}
            <ul className="mt-5 space-y-2.5 text-sm text-muted">
              {s.timeline_text && <li className="flex gap-2"><IconClock className="h-4 w-4 shrink-0 text-cyan-300" /> {s.timeline_text}</li>}
              {s.billing_type === "one_time" && (
                <li className="flex gap-2"><IconRepeat className="h-4 w-4 shrink-0 text-cyan-300" /> {s.revisions_included} rounds of revisions included</li>
              )}
              {deposit !== null && (
                <li className="flex gap-2"><IconCheck className="h-4 w-4 shrink-0 text-cyan-300" /> {s.deposit_percent}% deposit to start{s.purchase_mode === "direct" ? ` (${formatMYR(deposit)} for the base package)` : ""}</li>
              )}
              {s.billing_type === "monthly" && <li className="flex gap-2"><IconCheck className="h-4 w-4 shrink-0 text-cyan-300" /> Billed monthly · cancel anytime</li>}
            </ul>
            <div className="mt-6 flex flex-col gap-2">
              <ButtonLink href={cta.href} size="lg">{cta.label}</ButtonLink>
              <ButtonLink href="/book" variant="secondary"><IconCalendar className="h-4 w-4" /> Talk to us first</ButtonLink>
            </div>
            {s.purchase_mode === "quote" && (
              <p className="mt-4 text-xs text-subtle">Final price depends on scope and is confirmed in a written quotation before any payment.</p>
            )}
          </Card>
        </Container>
      </section>

      <section className="pb-20">
        <Container className="grid gap-6 md:grid-cols-2">
          <Reveal>
            <Card className="h-full">
              <h2 className="text-lg font-semibold text-fg">What&apos;s included</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted">
                {s.deliverables.map((d) => (
                  <li key={d} className="flex gap-3"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{d}</li>
                ))}
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={80}>
            <Card className="h-full">
              <h2 className="text-lg font-semibold text-fg">Not included</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted">
                {s.exclusions.map((d) => (
                  <li key={d} className="flex gap-3"><IconX className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />{d}</li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-subtle">Need something on this list? Ask for it in your quote request and we&apos;ll price it separately.</p>
            </Card>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
