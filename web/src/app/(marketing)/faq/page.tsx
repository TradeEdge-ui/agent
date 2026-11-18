import type { Metadata } from "next";
import { Container, CtaBand, JsonLd, PageHero } from "@/components/marketing/sections";
import { FAQS } from "@/content/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about pricing, payments, timelines, revisions, ownership, AI chatbots and maintenance plans.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
      <PageHero eyebrow="FAQ" title="Questions, answered." description="Can't find what you're looking for? Send us a message or book a free call." />
      <section className="pb-12">
        <Container className="max-w-3xl">
          <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/10">
            {FAQS.map((f) => (
              <details key={f.q} className="group px-5 py-4 open:bg-white/[0.02]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-fg">
                  {f.q}
                  <span className="text-brand-300 transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>
      <CtaBand title="Still have questions?" description="We're happy to explain anything before you commit." />
    </>
  );
}
