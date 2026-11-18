import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHero } from "@/components/marketing/sections";
import { Card } from "@/components/ui/primitives";
import { ContactForm } from "@/components/forms/contact-form";
import { getBusinessSettings, whatsappLink } from "@/lib/settings";
import { buttonClass } from "@/components/ui/button";
import { IconCalendar, IconChat } from "@/components/icons";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact ARyzz AI Solutions about websites, AI chatbots, automation and maintenance plans.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const s = await getBusinessSettings();
  const wa = whatsappLink(s.whatsapp, "Hi ARyzz, I'd like to ask about a project.");
  return (
    <>
      <PageHero eyebrow="Contact" title="Let's talk." description="Send a message, chat on WhatsApp or book a free 30-minute consultation." />
      <section className="pb-20">
        <Container className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="p-6 sm:p-8"><ContactForm /></Card>
          <div className="space-y-5">
            <Card>
              <h2 className="font-semibold text-fg">Reach us directly</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {s.email && <div><dt className="text-subtle">Email</dt><dd><a className="text-fg hover:text-brand-300" href={`mailto:${s.email}`}>{s.email}</a></dd></div>}
                {s.phone && <div><dt className="text-subtle">Phone</dt><dd className="text-fg">{s.phone}</dd></div>}
                {s.address && <div><dt className="text-subtle">Address</dt><dd className="whitespace-pre-line text-fg">{s.address}</dd></div>}
                <div><dt className="text-subtle">Hours</dt><dd className="text-fg">Mon–Fri, 9am–6pm (MYT)</dd></div>
              </dl>
              <div className="mt-5 flex flex-col gap-2">
                {wa && <a className={buttonClass("secondary")} href={wa} target="_blank" rel="noopener noreferrer"><IconChat className="h-4 w-4" /> WhatsApp us</a>}
                <Link className={buttonClass("primary")} href="/book"><IconCalendar className="h-4 w-4" /> Book a consultation</Link>
              </div>
            </Card>
          </div>
        </Container>
      </section>
    </>
  );
}
