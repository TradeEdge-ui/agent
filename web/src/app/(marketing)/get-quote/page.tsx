import type { Metadata } from "next";
import { Container, PageHero } from "@/components/marketing/sections";
import { Card } from "@/components/ui/primitives";
import { QuoteRequestForm } from "@/components/forms/quote-request-form";
import { IconCheck } from "@/components/icons";
import { getServices } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Get a Free Quote",
  description: "Tell us about your website, AI chatbot or automation project and receive a fixed-scope quotation in Malaysian Ringgit.",
  alternates: { canonical: "/get-quote" },
};

export default async function GetQuotePage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  const services = (await getServices()).map((s) => ({ slug: s.slug, name: s.name }));
  const selected = services.some((s) => s.slug === service) ? service : undefined;
  return (
    <>
      <PageHero eyebrow="Free quotation" title="Tell us about your project" description="The more detail you share, the more accurate your quotation. Takes about 3 minutes." />
      <section className="pb-20">
        <Container className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <Card className="p-6 sm:p-8">
            <QuoteRequestForm services={services} defaultService={selected} />
          </Card>
          <div className="space-y-5">
            <Card>
              <h2 className="font-semibold text-fg">What happens next</h2>
              <ol className="mt-4 space-y-3 text-sm text-muted">
                {[
                  "We review your request and may ask a few questions.",
                  "You receive a written quotation with scope, timeline and payment schedule.",
                  "Accept online and pay the deposit by card or FPX — or by bank transfer.",
                  "We kick off, and you track progress in your client portal.",
                ].map((t, i) => (
                  <li key={t} className="flex gap-3"><span className="text-gradient font-semibold">{i + 1}</span>{t}</li>
                ))}
              </ol>
            </Card>
            <Card>
              <h2 className="font-semibold text-fg">Our promise</h2>
              <ul className="mt-4 space-y-2.5 text-sm text-muted">
                {["No obligation, no spam", "Prices in RM with everything listed", "Nothing is charged until you accept"].map((t) => (
                  <li key={t} className="flex gap-2.5"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{t}</li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </section>
    </>
  );
}
