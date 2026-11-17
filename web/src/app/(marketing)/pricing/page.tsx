import type { Metadata } from "next";
import Link from "next/link";
import { Container, CtaBand, PageHero, SectionHeading, serviceCta } from "@/components/marketing/sections";
import { Reveal } from "@/components/marketing/reveal";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { IconCard, IconCheck, IconShield } from "@/components/icons";
import { CATEGORY_LABELS, getServices, groupByCategory } from "@/lib/catalog";
import { priceLabel } from "@/lib/money";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Pricing",
  description: "Transparent website development, AI automation and maintenance pricing in Malaysian Ringgit. Deliverables, revisions and exclusions listed for every package.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const grouped = groupByCategory(await getServices());
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title={<>Honest prices in <span className="text-gradient">Ringgit</span>.</>}
        description="Ranges reflect scope — number of pages, features and content. You always receive a written, fixed quotation before paying anything beyond a published base package."
      />
      {(["website", "ai", "maintenance"] as const).map((cat) => (
        <section key={cat} className="py-10">
          <Container>
            <SectionHeading title={CATEGORY_LABELS[cat]} />
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              {grouped[cat].map((s, i) => {
                const cta = serviceCta(s);
                return (
                  <Reveal key={s.slug} delay={i * 40} className="grid gap-4 border-b border-white/[0.06] bg-white/[0.02] p-5 last:border-b-0 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] sm:items-center">
                    <div>
                      <Link href={`/services/${s.slug}`} className="font-semibold text-fg hover:text-brand-300">{s.name}</Link>
                      <p className="mt-1 text-sm text-muted">{s.tagline}</p>
                      <p className="mt-2 text-xs text-subtle">
                        {s.billing_type === "monthly" ? "Monthly · cancel anytime" : `${s.revisions_included} revision rounds · ${s.timeline_text ?? "timeline in quote"}`}
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-fg">{priceLabel(s)}</p>
                    <ButtonLink href={cta.href} size="sm" variant={s.purchase_mode === "direct" ? "primary" : "secondary"}>{cta.label}</ButtonLink>
                  </Reveal>
                );
              })}
            </div>
          </Container>
        </section>
      ))}

      <section className="py-16">
        <Container className="grid gap-5 md:grid-cols-3">
          <Card>
            <IconCard className="h-5 w-5 text-cyan-300" />
            <h3 className="mt-3 font-semibold text-fg">How payment works</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li className="flex gap-2"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Projects: a deposit to start (usually 50%), the balance at agreed milestones or on completion.</li>
              <li className="flex gap-2"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Care plans: billed monthly by card; cancel anytime from your dashboard.</li>
              <li className="flex gap-2"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Pay online by card or FPX online banking, or by bank transfer on request.</li>
            </ul>
          </Card>
          <Card>
            <IconShield className="h-5 w-5 text-cyan-300" />
            <h3 className="mt-3 font-semibold text-fg">What affects the price</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>Number of pages, products or screens</li>
              <li>Custom design vs. adapted template</li>
              <li>Copywriting, bilingual content, photography</li>
              <li>Integrations (payments, CRM, WhatsApp, APIs)</li>
            </ul>
          </Card>
          <Card>
            <IconShield className="h-5 w-5 text-cyan-300" />
            <h3 className="mt-3 font-semibold text-fg">Third-party costs</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Domains, hosting plans, paid plugins, AI usage and payment-gateway fees are charged by those providers. We list them in your quotation
              so there are no surprises. Prices shown exclude SST unless stated — we charge SST only if and when we are registered.
            </p>
          </Card>
        </Container>
      </section>
      <CtaBand title="Get a precise quote in writing" description="Share your requirements and we'll send a fixed-scope quotation you can accept and pay online." />
    </>
  );
}
