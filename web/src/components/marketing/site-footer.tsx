import Link from "next/link";
import { Logo } from "@/components/logo";
import type { BusinessSettings } from "@/lib/types";
import { whatsappLink } from "@/lib/settings";

export function SiteFooter({ settings }: { settings: BusinessSettings }) {
  const wa = whatsappLink(settings.whatsapp);
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/[0.06] bg-ink-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Websites, AI chatbots and automation for Malaysian businesses — with transparent pricing, clear scope and secure online payments.
          </p>
          <div className="mt-4 space-y-1 text-sm text-muted">
            {settings.email && (
              <p>
                Email: <a className="text-fg hover:text-brand-300" href={`mailto:${settings.email}`}>{settings.email}</a>
              </p>
            )}
            {settings.phone && <p>Phone: <a className="text-fg hover:text-brand-300" href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a></p>}
            {wa && <p><a className="text-fg hover:text-brand-300" href={wa} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></p>}
            {settings.registration_no && <p>{settings.legal_name ?? settings.business_name} ({settings.registration_no})</p>}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">Services</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link className="hover:text-fg" href="/services#website">Website development</Link></li>
            <li><Link className="hover:text-fg" href="/services#ai">AI solutions</Link></li>
            <li><Link className="hover:text-fg" href="/services#maintenance">Care plans</Link></li>
            <li><Link className="hover:text-fg" href="/pricing">Pricing</Link></li>
            <li><Link className="hover:text-fg" href="/book">Free consultation</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link className="hover:text-fg" href="/about">About</Link></li>
            <li><Link className="hover:text-fg" href="/portfolio">Work</Link></li>
            <li><Link className="hover:text-fg" href="/faq">FAQ</Link></li>
            <li><Link className="hover:text-fg" href="/contact">Contact</Link></li>
            <li><Link className="hover:text-fg" href="/legal/terms">Terms of Service</Link></li>
            <li><Link className="hover:text-fg" href="/legal/privacy">Privacy Policy</Link></li>
            <li><Link className="hover:text-fg" href="/legal/refund">Refund Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {year} {settings.business_name}. All rights reserved.</p>
          <p>Payments are processed securely by Stripe. We never see or store your card details.</p>
        </div>
      </div>
    </footer>
  );
}
