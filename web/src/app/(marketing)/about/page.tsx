import type { Metadata } from "next";
import { Container, CtaBand, PageHero, SectionHeading } from "@/components/marketing/sections";
import { Reveal } from "@/components/marketing/reveal";
import { Card } from "@/components/ui/primitives";
import { IconBot, IconLock, IconShield, IconSparkles } from "@/components/icons";

export const metadata: Metadata = {
  title: "About",
  description: "ARyzz AI Solutions is a Malaysian web development and AI automation studio focused on transparent pricing and accountable delivery.",
  alternates: { canonical: "/about" },
};

const values = [
  { icon: IconShield, title: "Transparency first", text: "Published prices, written scope, listed exclusions and revision limits. If something costs extra, you'll know before it happens." },
  { icon: IconSparkles, title: "Speed through AI — quality through people", text: "AI tools help us design, code and test faster. A human reviews every deliverable before it reaches you." },
  { icon: IconLock, title: "Security by default", text: "Modern hosting, HTTPS, least-privilege access and payment processing through Stripe. We never store card details." },
  { icon: IconBot, title: "Practical AI, honest limits", text: "We'll tell you when AI is the right tool — and when a simple form or a human is better. No hype, no lock-in." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About ARyzz"
        title="A Malaysian studio for the AI era of small business."
        description="ARyzz AI Solutions helps SMEs, founders and local businesses get online properly and put AI to work — without enterprise price tags or confusing contracts."
      />
      <section className="py-12">
        <Container className="grid gap-10 lg:grid-cols-2">
          <Reveal className="space-y-4 text-muted leading-relaxed">
            <p>
              Most small businesses don&apos;t need a big agency. They need a website that loads fast and brings in enquiries, answers to customer
              questions at 11pm, and less time lost on repetitive admin. That&apos;s what we build.
            </p>
            <p>
              We&apos;re a focused, founder-led studio. When you work with ARyzz, you speak directly with the person responsible for your project,
              from the first call to launch and beyond.
            </p>
            <p>
              We combine modern web engineering (Next.js, TypeScript, PostgreSQL) with carefully-guarded AI so we can deliver in days or weeks, not
              months — and keep prices fair.
            </p>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={i * 60}>
                <Card className="h-full p-5">
                  <v.icon className="h-5 w-5 text-cyan-300" />
                  <h3 className="mt-3 font-semibold text-fg">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{v.text}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>
      <section className="py-12">
        <Container>
          <SectionHeading eyebrow="How we use AI" title="AI helps us work faster. It never makes decisions for you." />
          <Reveal className="mt-6 max-w-3xl space-y-3 text-muted leading-relaxed">
            <p>
              We use AI assistants to draft code, documentation and proposals, which a human then reviews and edits. Pricing, delivery dates,
              refunds and anything that affects your money or your published website are always decided by a person.
            </p>
            <p>
              When we build AI for you, we design the same safeguards in: clear boundaries on what the AI may say, hand-over to a human, and logs
              you can review. See our <a className="text-brand-300 underline" href="/legal/privacy">Privacy Policy</a> for how data is handled.
            </p>
          </Reveal>
        </Container>
      </section>
      <CtaBand title="Let's talk about your goals" description="A free 30-minute call is the fastest way to find out whether we're the right fit." />
    </>
  );
}
