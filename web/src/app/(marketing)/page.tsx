import Link from "next/link";
import { Container, CtaBand, JsonLd, SectionHeading, ServiceCard } from "@/components/marketing/sections";
import { Reveal } from "@/components/marketing/reveal";
import { ButtonLink } from "@/components/ui/button";
import {
  IconArrowRight, IconBot, IconCalendar, IconCard, IconChart, IconCheck, IconCode, IconLock,
  IconRocket, IconShield, IconSparkles, IconWorkflow, IconWrench,
} from "@/components/icons";
import { getServices } from "@/lib/catalog";
import { getBusinessSettings } from "@/lib/settings";
import { createPublicClient } from "@/lib/supabase/public";
import { siteConfig } from "@/lib/config";
import type { PortfolioItem, Testimonial } from "@/lib/types";

export const revalidate = 300;

async function getShowcase() {
  const supabase = createPublicClient();
  if (!supabase) return { portfolio: [] as PortfolioItem[], testimonials: [] as Testimonial[] };
  const [p, t] = await Promise.all([
    supabase.from("portfolio_items").select("*").eq("is_published", true).order("sort_order").limit(3),
    supabase.from("testimonials").select("*").eq("is_published", true).eq("consent_to_publish", true).order("created_at", { ascending: false }).limit(3),
  ]);
  return { portfolio: (p.data ?? []) as PortfolioItem[], testimonials: (t.data ?? []) as Testimonial[] };
}

const pillars = [
  {
    icon: IconCode,
    title: "Website Development",
    text: "Fast, mobile-first websites, online stores and web apps that are built to convert — and that you fully own.",
    href: "/services#website",
  },
  {
    icon: IconBot,
    title: "AI Chatbots & Agents",
    text: "Assistants that answer customers 24/7, capture leads and hand over to you — with guardrails against made-up answers.",
    href: "/services#ai",
  },
  {
    icon: IconWorkflow,
    title: "Workflow Automation",
    text: "Connect your forms, sheets, CRM and messaging so repetitive admin runs itself, with humans approving what matters.",
    href: "/services#ai",
  },
  {
    icon: IconWrench,
    title: "Monthly Care Plans",
    text: "Updates, backups, monitoring and edits every month, so your site stays secure and current. Cancel anytime.",
    href: "/services#maintenance",
  },
];

const steps = [
  { title: "Tell us what you need", text: "Send a short brief or book a free 30-minute consultation." },
  { title: "Get a clear quotation", text: "Fixed scope, deliverables, revisions and exclusions — in writing, in RM." },
  { title: "Approve & pay the deposit", text: "Accept online and pay securely by card or FPX. No surprises." },
  { title: "Track progress live", text: "Milestones, updates, files and revision requests in your client portal." },
  { title: "Launch & grow", text: "We go live, hand over, and keep things running with an optional care plan." },
];

const reasons = [
  { icon: IconSparkles, title: "AI-assisted delivery", text: "We use modern AI tooling to build faster, then review every line ourselves. You get speed without cutting corners." },
  { icon: IconShield, title: "Transparent scope", text: "Every package lists what's included, revision limits and what's not — before you pay a single sen." },
  { icon: IconCard, title: "Secure online payments", text: "Pay deposits, milestones and subscriptions through Stripe. Card details never touch our servers." },
  { icon: IconChart, title: "You stay in control", text: "Approve quotes, track milestones and download invoices and receipts any time from your dashboard." },
];

export default async function HomePage() {
  const [services, settings, showcase] = await Promise.all([getServices(), getBusinessSettings(), getShowcase()]);
  const featured = services.filter((s) => s.is_featured).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: settings.business_name,
    url: siteConfig.url,
    description: siteConfig.description,
    areaServed: { "@type": "Country", name: "Malaysia" },
    currenciesAccepted: "MYR",
    paymentAccepted: "Credit Card, Debit Card, FPX, Bank Transfer",
    ...(settings.email ? { email: settings.email } : {}),
    ...(settings.phone ? { telephone: settings.phone } : {}),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services",
      itemListElement: services.filter((s) => s.price_min_cents).map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.name, description: s.tagline ?? undefined },
        priceSpecification: {
          "@type": "PriceSpecification",
          priceCurrency: "MYR",
          minPrice: (s.price_min_cents ?? 0) / 100,
          ...(s.price_max_cents ? { maxPrice: s.price_max_cents / 100 } : {}),
        },
      })),
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -top-32 left-1/4 h-96 w-96 animate-float rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute top-20 right-0 h-80 w-80 animate-float rounded-full bg-cyan-glow/15 blur-3xl [animation-delay:-6s]" />
        <Container className="relative grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-200">
                <IconSparkles className="h-3.5 w-3.5" /> Web development & AI automation · Malaysia
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-fg sm:text-6xl">
                Websites and AI that <span className="text-gradient">win you customers</span> — while you sleep.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                ARyzz AI Solutions builds high-performance websites, AI chatbots and workflow automations for Malaysian businesses.
                Clear packages, fixed scope, secure online payment — and a client portal to follow every milestone.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/get-quote" size="lg">
                  Get a free quote <IconArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href="/book" variant="secondary" size="lg">
                  <IconCalendar className="h-4 w-4" /> Book a free consultation
                </ButtonLink>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                {["Transparent RM pricing", "Card & FPX via Stripe", "You own your website"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><IconCheck className="h-4 w-4 text-emerald-400" />{t}</li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Product visual: a stylised client-portal card (illustrative UI, not client data). */}
          <Reveal delay={200} className="relative hidden lg:block">
            <div className="glass glow-border relative rounded-3xl p-6 shadow-2xl shadow-brand-900/40">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-fg">Client portal</p>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300">Live preview</span>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-ink-900/70 p-4">
                <p className="text-xs text-subtle">Your project</p>
                <p className="mt-1 font-medium text-fg">Business Website</p>
                <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
                  <div className="h-2 w-[62%] rounded-full bg-gradient-to-r from-brand-500 to-cyan-glow" />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {[
                    ["Discovery & sitemap", "done"],
                    ["Design approved", "done"],
                    ["Development", "now"],
                    ["Launch", "next"],
                  ].map(([m, s]) => (
                    <div key={m} className="flex items-center justify-between">
                      <span className="text-muted">{m}</span>
                      <span className={s === "done" ? "text-emerald-300" : s === "now" ? "text-brand-300" : "text-subtle"}>
                        {s === "done" ? "Completed" : s === "now" ? "In progress" : "Up next"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-ink-900/70 p-4">
                  <p className="text-xs text-subtle">Next invoice</p>
                  <p className="mt-1 font-semibold text-fg">Final 50%</p>
                  <p className="text-xs text-muted">Pay by card or FPX</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-ink-900/70 p-4">
                  <p className="text-xs text-subtle">AI assistant</p>
                  <p className="mt-1 font-semibold text-fg">24/7</p>
                  <p className="text-xs text-muted">Leads captured</p>
                </div>
              </div>
              <div className="pointer-events-none absolute -bottom-6 -left-6 rounded-2xl border border-white/10 bg-ink-850/90 px-4 py-3 text-sm shadow-xl backdrop-blur">
                <p className="flex items-center gap-2 text-fg"><IconLock className="h-4 w-4 text-emerald-400" /> Payment verified</p>
                <p className="text-xs text-subtle">Confirmed by Stripe webhook</p>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Pillars */}
      <section className="py-20" id="what-we-do">
        <Container>
          <SectionHeading
            eyebrow="What we do"
            title="Everything your business needs to grow online"
            description="Start with a website, add AI that answers customers and automates admin, and keep it all healthy with a monthly care plan."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <Link href={p.href} className="glass group block h-full rounded-2xl p-6 transition hover:-translate-y-1 hover:border-brand-400/30">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-semibold text-fg">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm text-brand-300 group-hover:text-brand-200">
                    Explore <IconArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Featured packages */}
      {featured.length > 0 && (
        <section className="py-20">
          <Container>
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <SectionHeading eyebrow="Popular packages" title="Transparent pricing. No guesswork." description="Every package shows the price range, deliverables, revision limit and exclusions up front." />
              <ButtonLink href="/pricing" variant="secondary">See all pricing</ButtonLink>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {featured.map((s, i) => (
                <Reveal key={s.slug} delay={i * 80}>
                  <ServiceCard service={s} />
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Process */}
      <section className="py-20">
        <Container>
          <SectionHeading eyebrow="How it works" title="From first message to launch in five clear steps" center />
          <ol className="mt-14 grid gap-5 md:grid-cols-5">
            {steps.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 70} className="glass relative rounded-2xl p-5">
                <span className="text-sm font-semibold text-gradient">0{i + 1}</span>
                <h3 className="mt-3 font-semibold text-fg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </Container>
      </section>

      {/* Why us */}
      <section className="py-20">
        <Container className="grid gap-12 lg:grid-cols-2">
          <SectionHeading
            eyebrow="Why ARyzz"
            title="A focused studio that ships — and stays accountable"
            description="You work directly with the person building your project. No account-manager telephone game, no hidden extras, no locked-in contracts on care plans."
          />
          <div className="grid gap-5 sm:grid-cols-2">
            {reasons.map((r, i) => (
              <Reveal key={r.title} delay={i * 70} className="glass rounded-2xl p-5">
                <r.icon className="h-5 w-5 text-cyan-300" />
                <h3 className="mt-3 font-semibold text-fg">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{r.text}</p>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Work & words — only genuine content is ever shown */}
      <section className="py-20">
        <Container>
          {showcase.portfolio.length > 0 || showcase.testimonials.length > 0 ? (
            <>
              <SectionHeading eyebrow="Our work" title="Recent projects & client words" />
              {showcase.portfolio.length > 0 && (
                <div className="mt-10 grid gap-5 md:grid-cols-3">
                  {showcase.portfolio.map((p) => (
                    <Reveal key={p.id} className="glass rounded-2xl p-6">
                      <h3 className="font-semibold text-fg">{p.title}</h3>
                      {p.client_name && <p className="text-xs text-subtle">{p.client_name}</p>}
                      <p className="mt-3 text-sm text-muted">{p.summary}</p>
                      {p.live_url && (
                        <a href={p.live_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm text-brand-300">
                          Visit site <IconArrowRight className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </Reveal>
                  ))}
                </div>
              )}
              {showcase.testimonials.length > 0 && (
                <div className="mt-8 grid gap-5 md:grid-cols-3">
                  {showcase.testimonials.map((t) => (
                    <Reveal key={t.id} className="glass rounded-2xl p-6">
                      <blockquote className="text-sm leading-relaxed text-fg">“{t.quote}”</blockquote>
                      <p className="mt-4 text-sm font-medium text-fg">{t.author_name}</p>
                      <p className="text-xs text-subtle">{[t.author_title, t.company].filter(Boolean).join(", ")}</p>
                    </Reveal>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Reveal className="glass rounded-3xl p-8 sm:p-12">
              <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Founding clients</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-fg">We&apos;re new — and we&apos;ll earn your trust the honest way.</h2>
                  <p className="mt-4 text-muted">
                    You won&apos;t find stock logos or invented reviews here. What you can see is this platform itself — the website, client portal,
                    secure checkout and AI tooling behind it were designed and built by ARyzz. Book a call and we&apos;ll walk you through how it works
                    and how the same approach can work for your business.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <ButtonLink href="/book" size="lg"><IconCalendar className="h-4 w-4" /> Book a free consultation</ButtonLink>
                  <ButtonLink href="/portfolio" variant="secondary" size="lg"><IconRocket className="h-4 w-4" /> See our work</ButtonLink>
                </div>
              </div>
            </Reveal>
          )}
        </Container>
      </section>

      <CtaBand title="Ready to grow your business online?" description="Tell us about your project and get a clear, written quotation — or start right away with a Starter Website." />
    </>
  );
}
