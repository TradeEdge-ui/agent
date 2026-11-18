import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/marketing/reveal";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { priceLabel, formatPrice } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { Service } from "@/lib/types";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

export function SectionHeading({ eyebrow, title, description, center = false }: { eyebrow?: string; title: ReactNode; description?: ReactNode; center?: boolean }) {
  return (
    <Reveal className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">{eyebrow}</p>}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-muted">{description}</p>}
    </Reveal>
  );
}

export function PageHero({ eyebrow, title, description, children }: { eyebrow?: string; title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[48rem] -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl" />
      <Container className="relative py-16 sm:py-24">
        <div className="max-w-3xl">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">{eyebrow}</p>}
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-fg sm:text-5xl">{title}</h1>
          {description && <p className="mt-5 text-lg leading-relaxed text-muted">{description}</p>}
          {children && <div className="mt-8">{children}</div>}
        </div>
      </Container>
    </section>
  );
}

export function serviceCta(s: Service): { href: string; label: string } {
  if (s.purchase_mode === "direct" && s.billing_type === "monthly") return { href: `/order/${s.slug}`, label: "Subscribe" };
  if (s.purchase_mode === "direct") return { href: `/order/${s.slug}`, label: "Order online" };
  return { href: `/get-quote?service=${s.slug}`, label: "Request a quote" };
}

export function ServiceCard({ service, compact = false }: { service: Service; compact?: boolean }) {
  const cta = serviceCta(service);
  return (
    <div className={cn("glass group relative flex h-full flex-col rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-brand-400/30", service.is_featured && "glow-border")}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-fg">{service.name}</h3>
        {service.is_featured && <Badge tone="brand">Popular</Badge>}
      </div>
      {service.tagline && <p className="mt-2 text-sm leading-relaxed text-muted">{service.tagline}</p>}
      <p className="mt-5 text-2xl font-semibold tracking-tight text-fg">{priceLabel(service)}</p>
      {service.purchase_mode === "direct" && service.billing_type === "one_time" && service.price_min_cents && (
        <p className="mt-1 text-xs text-subtle">
          Base package {formatPrice(service.price_min_cents)} · {service.deposit_percent}% deposit to start
        </p>
      )}
      {!compact && (
        <ul className="mt-5 space-y-2.5 text-sm text-muted">
          {service.deliverables.slice(0, 4).map((d) => (
            <li key={d} className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
        <ButtonLink href={cta.href} size="sm">
          {cta.label}
        </ButtonLink>
        <Link href={`/services/${service.slug}`} className="inline-flex items-center gap-1 text-sm text-brand-300 hover:text-brand-200">
          Full details <IconArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function CtaBand({ title, description }: { title: string; description: string }) {
  return (
    <section className="py-20">
      <Container>
        <Reveal className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-700/40 via-ink-850 to-ink-900 px-6 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-glow/20 blur-3xl" />
          <h2 className="relative text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{title}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-muted">{description}</p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/get-quote" size="lg">Get a free quote</ButtonLink>
            <ButtonLink href="/book" variant="secondary" size="lg">Book a free consultation</ButtonLink>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is escaped for "<" to prevent script injection.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
