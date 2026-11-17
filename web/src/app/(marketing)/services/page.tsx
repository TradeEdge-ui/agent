import type { Metadata } from "next";
import { Container, CtaBand, PageHero, SectionHeading, ServiceCard } from "@/components/marketing/sections";
import { Reveal } from "@/components/marketing/reveal";
import { ButtonLink } from "@/components/ui/button";
import { CATEGORY_LABELS, getServices, groupByCategory } from "@/lib/catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Services",
  description: "Website development, e-commerce, custom web apps, AI chatbots, AI workflow automation and monthly website maintenance plans in Malaysia.",
  alternates: { canonical: "/services" },
};

const intros = {
  website: "From a simple business presence to a full online store or custom web application.",
  ai: "Practical AI that saves you time and answers customers — designed with guardrails and human approval.",
  maintenance: "Monthly plans that keep your site secure, backed up and up to date. Cancel anytime.",
} as const;

export default async function ServicesPage() {
  const grouped = groupByCategory(await getServices());
  return (
    <>
      <PageHero
        eyebrow="Services"
        title={<>Build, automate and <span className="text-gradient">grow</span>.</>}
        description="Every service has a clear scope, revision limit and list of exclusions so you know exactly what you are paying for."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="#website" variant="secondary" size="sm">Websites</ButtonLink>
          <ButtonLink href="#ai" variant="secondary" size="sm">AI solutions</ButtonLink>
          <ButtonLink href="#maintenance" variant="secondary" size="sm">Care plans</ButtonLink>
        </div>
      </PageHero>
      {(["website", "ai", "maintenance"] as const).map((cat) =>
        grouped[cat].length ? (
          <section key={cat} id={cat} className="scroll-mt-20 py-14">
            <Container>
              <SectionHeading title={CATEGORY_LABELS[cat]} description={intros[cat]} />
              <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {grouped[cat].map((s, i) => (
                  <Reveal key={s.slug} delay={i * 60}>
                    <ServiceCard service={s} />
                  </Reveal>
                ))}
              </div>
            </Container>
          </section>
        ) : null,
      )}
      <CtaBand title="Not sure which package fits?" description="Describe what you need and we'll recommend the right option — no obligation." />
    </>
  );
}
