import type { Metadata } from "next";
import Link from "next/link";
import { getBusinessSettings } from "@/lib/settings";
import { LEGAL_LAST_UPDATED } from "@/content/legal";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/legal/privacy" } };

export default async function PrivacyPage() {
  const s = await getBusinessSettings();
  const entity = `${s.legal_name ?? s.business_name}${s.registration_no ? ` (${s.registration_no})` : ""}`;
  const contact = s.email ? <a href={`mailto:${s.email}`}>{s.email}</a> : <Link href="/contact">our contact form</Link>;
  return (
    <>
      <h1 className="text-3xl font-semibold text-fg">Privacy Policy</h1>
      <p className="mt-2 text-sm text-subtle">Last updated: {LEGAL_LAST_UPDATED}</p>
      <p className="mt-6">{entity} respects your privacy and processes personal data in accordance with the Personal Data Protection Act 2010 (Malaysia) (&quot;PDPA&quot;). This notice explains what we collect, why, and your rights.</p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Contact and enquiry details</strong> — name, email, phone, company, and the information you include in quote requests, messages and consultation bookings.</li>
        <li><strong>Account data</strong> — login email, password (stored only as a secure hash by our authentication provider), profile details.</li>
        <li><strong>Project data</strong> — requirements, files you upload, messages, revision requests and deliverables.</li>
        <li><strong>Billing data</strong> — invoices, payment status and receipts. Card and bank details are entered on Stripe&apos;s secure page and are not stored by us.</li>
        <li><strong>Technical data</strong> — IP address (used for security and abuse prevention), and essential cookies that keep you signed in.</li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>To respond to enquiries, prepare quotations and deliver the services you request.</li>
        <li>To process payments, issue invoices and receipts, and keep business and tax records.</li>
        <li>To send service messages (e.g. quotation ready, payment received, project updates). Marketing emails are only sent if you opt in, and you can opt out at any time.</li>
        <li>To protect our systems against spam, fraud and misuse.</li>
      </ul>

      <h2>3. AI processing</h2>
      <p>We use an AI assistant (provided by Anthropic) to help us summarise requirements and draft proposals and messages. Relevant enquiry or project details may be sent to the AI provider for this purpose under its commercial API terms. A person always reviews AI output before it is used, and AI is never used to make decisions about payments, refunds or pricing.</p>

      <h2>4. Who we share data with</h2>
      <p>We use trusted service providers (&quot;processors&quot;) to run this platform: Supabase (database, authentication and file storage), Vercel (website hosting), Stripe (payment processing), Resend (transactional email) and Anthropic (AI assistance). These providers may store or process data outside Malaysia, with safeguards required by their terms. We do not sell your personal data. We may disclose data where required by law.</p>

      <h2>5. Cookies</h2>
      <p>We use only essential cookies needed for sign-in and security. We do not use advertising or third-party analytics cookies on this site.</p>

      <h2>6. Retention</h2>
      <p>We keep enquiry data for up to 24 months if no project proceeds, and project and billing records for at least 7 years to meet accounting and tax obligations. You can ask us to delete data we are not required to keep.</p>

      <h2>7. Security</h2>
      <p>Data is encrypted in transit (HTTPS). Access is restricted by role, and each client can only see their own records. Uploaded files are stored privately and shared through short-lived links.</p>

      <h2>8. Your rights</h2>
      <p>Under the PDPA you may request access to and correction of your personal data, withdraw consent, and limit processing (for example, for direct marketing). Contact {contact}. We will respond within 21 days. If you withdraw consent needed to provide a service, we may be unable to continue that service.</p>

      <h2>9. Changes</h2>
      <p>We may update this policy and will post the new version here with a new date.</p>
    </>
  );
}
