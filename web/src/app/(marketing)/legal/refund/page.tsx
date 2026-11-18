import type { Metadata } from "next";
import Link from "next/link";
import { getBusinessSettings } from "@/lib/settings";
import { LEGAL_LAST_UPDATED } from "@/content/legal";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Refund Policy", alternates: { canonical: "/legal/refund" } };

export default async function RefundPage() {
  const s = await getBusinessSettings();
  return (
    <>
      <h1 className="text-3xl font-semibold text-fg">Refund Policy</h1>
      <p className="mt-2 text-sm text-subtle">Last updated: {LEGAL_LAST_UPDATED}</p>
      <p className="mt-6">We want every client to be confident paying us. This policy explains when refunds apply. Every refund is reviewed and approved by a person — refunds are never issued automatically.</p>

      <h2>1. Project deposits</h2>
      <ul>
        <li><strong>Before work starts:</strong> if you cancel before we begin work on your project (before the kick-off or before any design or development is delivered), your deposit is refunded in full, less any third-party costs already incurred on your behalf with your approval (e.g. a registered domain).</li>
        <li><strong>After work starts:</strong> the deposit covers work completed and is not refundable. We will deliver the work-in-progress you have paid for.</li>
      </ul>

      <h2>2. Milestone and final payments</h2>
      <p>Milestone payments are for completed milestones and are not refundable once that milestone has been delivered and accepted. If we cannot deliver an agreed milestone within the agreed scope and are unable to fix it within a reasonable time, we will refund the payment for the undelivered portion.</p>

      <h2>3. Monthly care plans</h2>
      <ul>
        <li>You can cancel anytime; your plan remains active until the end of the paid month and you will not be charged again.</li>
        <li>Partial months are not refunded, except where required by law or where we failed to provide the service.</li>
        <li>Unused included hours do not roll over or convert to cash.</li>
      </ul>

      <h2>4. Third-party fees</h2>
      <p>Fees paid to third parties (domains, hosting, licences, AI usage, payment-processing fees) are generally non-refundable because they are paid to those providers.</p>

      <h2>5. Duplicate or mistaken payments</h2>
      <p>If you were charged twice or paid more than the invoice amount, we refund the excess in full once verified.</p>

      <h2>6. How to request a refund</h2>
      <p>Email {s.email ? <a href={`mailto:${s.email}`}>{s.email}</a> : <Link href="/contact">us</Link>} with your invoice number and reason. We aim to respond within 5 business days. Approved refunds go back to the original payment method; card and FPX refunds usually take 5–10 business days to appear, depending on your bank.</p>
      <p>Please contact us before raising a chargeback with your bank — we will always try to resolve the issue directly.</p>

      <h2>7. Your statutory rights</h2>
      <p>This policy does not affect any rights you have under Malaysian consumer protection law.</p>
    </>
  );
}
