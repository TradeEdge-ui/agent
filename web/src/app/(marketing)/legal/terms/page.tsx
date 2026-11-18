import type { Metadata } from "next";
import Link from "next/link";
import { getBusinessSettings } from "@/lib/settings";
import { LEGAL_LAST_UPDATED } from "@/content/legal";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Terms of Service", alternates: { canonical: "/legal/terms" } };

export default async function TermsPage() {
  const s = await getBusinessSettings();
  const entity = `${s.legal_name ?? s.business_name}${s.registration_no ? ` (${s.registration_no})` : ""}`;
  return (
    <>
      <h1 className="text-3xl font-semibold text-fg">Terms of Service</h1>
      <p className="mt-2 text-sm text-subtle">Last updated: {LEGAL_LAST_UPDATED}</p>

      <p className="mt-6">These Terms govern the services provided by {entity} (&quot;ARyzz&quot;, &quot;we&quot;, &quot;us&quot;) to you (&quot;the Client&quot;) through this website and client portal. By requesting a quotation, placing an order, subscribing to a plan or paying an invoice, you agree to these Terms.</p>

      <h2>1. Services and scope</h2>
      <p>Each service package lists its deliverables, included revision rounds, estimated timeline and exclusions. For quoted work, the accepted quotation defines the scope. Anything not listed in the package or quotation is out of scope and will be quoted separately before we do it.</p>

      <h2>2. Quotations and orders</h2>
      <ul>
        <li>Quotations are valid until the date shown on them. Prices are in Malaysian Ringgit (RM).</li>
        <li>A project starts once you accept the quotation (or place an online order) and the first payment is confirmed.</li>
        <li>Base-package online orders are for the scope described on the package page; if your needs exceed it, we will propose a written change before continuing.</li>
      </ul>

      <h2>3. Payments</h2>
      <ul>
        <li>Projects are paid according to the payment schedule in your quotation or order — typically a deposit to start and the balance at agreed milestones or on completion.</li>
        <li>Online payments are processed by Stripe. We do not see or store your full card details. A payment is only treated as received once confirmed by the payment provider or, for bank transfers, once the funds are verified in our account.</li>
        <li>Invoices are due by the date shown. We may pause work on overdue invoices after giving you notice.</li>
        <li>SST is charged only if we are registered for it, and is shown separately on quotations and invoices.</li>
        <li>Third-party costs (domains, hosting, licences, AI usage, payment-gateway fees) are payable to those providers and are not included unless stated.</li>
      </ul>

      <h2>4. Your responsibilities</h2>
      <ul>
        <li>Provide content, materials, access and feedback in a timely way. Timelines are estimates and depend on receiving these.</li>
        <li>Ensure you have the rights to all content you give us (text, images, logos, data) and that its use does not infringe anyone&apos;s rights or Malaysian law.</li>
        <li>Review deliverables and raise revision requests through the client portal within the revision rounds included.</li>
      </ul>

      <h2>5. Revisions and change requests</h2>
      <p>A revision round is one consolidated set of changes to work within the agreed scope. Additional rounds, new features or changes to approved designs are change requests, quoted before work starts.</p>

      <h2>6. Ownership</h2>
      <p>On full payment of a project, you own the final deliverables and the custom code we wrote specifically for you. Until full payment, we retain ownership. Third-party components (frameworks, themes, plugins, fonts, platforms) remain subject to their own licences. We may reuse our general know-how, tools and non-client-specific code.</p>

      <h2>7. Warranty and support</h2>
      <p>We fix defects in work we delivered that are reported within 30 days of launch, at no charge. This does not cover changes in scope, issues caused by third parties, hosting providers, or changes made by anyone other than us. Ongoing support is available through our monthly care plans.</p>

      <h2>8. Monthly care plans (subscriptions)</h2>
      <ul>
        <li>Plans renew automatically each month and are charged to your saved payment method until cancelled.</li>
        <li>You may cancel at any time from your dashboard. Cancellation takes effect at the end of the current paid period; no further charges are made.</li>
        <li>Included hours or minutes are per month and do not roll over.</li>
        <li>We will give at least 30 days&apos; notice of any price change to an existing plan.</li>
      </ul>

      <h2>9. AI-powered deliverables</h2>
      <p>AI chatbots and automations can make mistakes. We design guardrails and human hand-over, but you remain responsible for reviewing outputs used in your business and for decisions made from them. AI provider usage fees are separate unless stated.</p>

      <h2>10. Confidentiality and showcase</h2>
      <p>We keep your non-public information confidential. We will only feature your project or testimonial publicly with your permission.</p>

      <h2>11. Limitation of liability</h2>
      <p>To the extent permitted by law, our total liability for any claim relating to a project or subscription is limited to the fees you paid for that project or, for subscriptions, the fees paid in the three months before the claim. We are not liable for indirect or consequential losses such as lost profits or data, except where such limitation is not permitted by law. Nothing in these Terms limits your rights under the Consumer Protection Act 1999 where it applies.</p>

      <h2>12. Termination</h2>
      <p>Either party may end a project by written notice. You pay for work completed up to that point under our <Link href="/legal/refund">Refund Policy</Link>, and we deliver the work-in-progress paid for.</p>

      <h2>13. Governing law</h2>
      <p>These Terms are governed by the laws of Malaysia, and the courts of Malaysia have jurisdiction.</p>

      <h2>14. Changes</h2>
      <p>We may update these Terms. The version in force when you accept a quotation or place an order applies to that engagement.</p>

      <h2>15. Contact</h2>
      <p>Questions about these Terms: {s.email ? <a href={`mailto:${s.email}`}>{s.email}</a> : <Link href="/contact">contact us</Link>}.</p>
    </>
  );
}
