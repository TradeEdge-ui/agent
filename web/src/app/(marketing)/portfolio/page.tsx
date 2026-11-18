import type { Metadata } from "next";
import { Container, CtaBand, PageHero } from "@/components/marketing/sections";
import { Reveal } from "@/components/marketing/reveal";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { createPublicClient } from "@/lib/supabase/public";
import type { PortfolioItem, Testimonial } from "@/lib/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Our Work",
  description: "Projects and genuine client testimonials from ARyzz AI Solutions.",
  alternates: { canonical: "/portfolio" },
};

const platformFeatures = [
  "Marketing website with service catalogue and transparent pricing",
  "Client portal: quotations, milestone tracking, file uploads, revision requests",
  "Secure Stripe checkout for deposits, milestones and monthly subscriptions",
  "Verified payment webhooks, invoices, receipts and billing history",
  "Admin CRM with revenue, expenses and profit tracking",
  "AI business assistant with strict human-approval guardrails",
];

export default async function PortfolioPage() {
  const supabase = createPublicClient();
  let items: PortfolioItem[] = [];
  let testimonials: Testimonial[] = [];
  if (supabase) {
    const [p, t] = await Promise.all([
      supabase.from("portfolio_items").select("*").eq("is_published", true).order("sort_order"),
      supabase.from("testimonials").select("*").eq("is_published", true).eq("consent_to_publish", true).order("created_at", { ascending: false }),
    ]);
    items = (p.data ?? []) as PortfolioItem[];
    testimonials = (t.data ?? []) as Testimonial[];
  }

  return (
    <>
      <PageHero
        eyebrow="Our work"
        title="Real projects. Real words."
        description="We only show work we actually delivered and testimonials clients gave us permission to publish."
      />
      <section className="pb-12">
        <Container>
          <Reveal>
            <Card className="glow-border">
              <Badge tone="brand">Case study · Built in-house</Badge>
              <h2 className="mt-4 text-2xl font-semibold text-fg">The ARyzz client platform</h2>
              <p className="mt-3 max-w-3xl text-muted">
                The site you are on is our own production system: a Next.js and Supabase application with Stripe payments, a client portal and an AI
                assistant. It is the same stack and engineering approach we use for client projects.
              </p>
              <ul className="mt-5 grid gap-2.5 text-sm text-muted sm:grid-cols-2">
                {platformFeatures.map((f) => (
                  <li key={f} className="flex gap-2.5"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{f}</li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </Container>
      </section>

      <section className="py-12">
        <Container>
          {items.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {items.map((p, i) => (
                <Reveal key={p.id} delay={i * 60}>
                  <Card className="flex h-full flex-col">
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={`${p.title} screenshot`} className="mb-4 aspect-video w-full rounded-xl object-cover" loading="lazy" />
                    )}
                    <h3 className="text-lg font-semibold text-fg">{p.title}</h3>
                    {p.client_name && <p className="text-xs text-subtle">{p.client_name}</p>}
                    <p className="mt-3 text-sm leading-relaxed text-muted">{p.summary}</p>
                    {p.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">{p.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
                    )}
                    {p.live_url && (
                      <a href={p.live_url} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1 pt-4 text-sm text-brand-300">
                        Visit live site <IconArrowRight className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </Card>
                </Reveal>
              ))}
            </div>
          ) : (
            <Card className="text-center">
              <h2 className="text-lg font-semibold text-fg">Client case studies are on the way</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
                We&apos;re onboarding our first clients now. Case studies appear here once projects are live and clients agree to be featured.
                Want to be one of them? Founding clients get our full attention.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <ButtonLink href="/get-quote">Start a project</ButtonLink>
                <ButtonLink href="/book" variant="secondary">Book a call</ButtonLink>
              </div>
            </Card>
          )}
        </Container>
      </section>

      {testimonials.length > 0 && (
        <section className="py-12">
          <Container>
            <h2 className="text-2xl font-semibold text-fg">What clients say</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <Card key={t.id}>
                  {t.rating && <p className="text-amber-300" aria-label={`${t.rating} out of 5 stars`}>{"★".repeat(t.rating)}<span className="text-subtle">{"★".repeat(5 - t.rating)}</span></p>}
                  <blockquote className="mt-3 text-sm leading-relaxed text-fg">“{t.quote}”</blockquote>
                  <p className="mt-4 text-sm font-medium text-fg">{t.author_name}</p>
                  <p className="text-xs text-subtle">{[t.author_title, t.company].filter(Boolean).join(", ")}</p>
                </Card>
              ))}
            </div>
          </Container>
        </section>
      )}
      <CtaBand title="Let's build your success story" description="Tell us where you want your business to be, and we'll show you how to get there." />
    </>
  );
}
