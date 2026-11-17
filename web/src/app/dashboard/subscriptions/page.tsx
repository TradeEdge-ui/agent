import { SearchParamAlerts, SectionTitle } from "@/components/app/bits";
import { SubscriptionToggle } from "@/components/forms/client-forms";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { openBillingPortal } from "@/actions/client";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getServices } from "@/lib/catalog";
import { formatMYR, priceLabel } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { Subscription } from "@/lib/types";

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ checkout?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*").eq("client_id", user.id).order("created_at", { ascending: false });
  const subs = (data ?? []) as Subscription[];
  const plans = (await getServices()).filter((s) => s.billing_type === "monthly" && s.purchase_mode === "direct");
  const activeServiceIds = new Set(subs.filter((s) => ["active", "trialing", "past_due"].includes(s.status)).map((s) => s.service_id));

  return (
    <>
      <SearchParamAlerts messages={[
        { when: sp.checkout === "success", tone: "info", text: "Thank you! Your subscription will appear here as soon as Stripe confirms the first payment (usually within seconds)." },
        { when: sp.checkout === "cancelled", tone: "warning", text: "Subscription checkout cancelled. You have not been charged." },
        { when: Boolean(sp.error), tone: "danger", text: sp.error },
      ]} />
      <PageHeader
        title="Care plans"
        description="Monthly maintenance and support subscriptions."
        actions={user.profile.stripe_customer_id ? (
          <form action={openBillingPortal}><Button type="submit" variant="secondary">Manage payment method & invoices</Button></form>
        ) : undefined}
      />
      {subs.length === 0 ? (
        <EmptyState title="No active plans">Keep your website secure and up to date with a monthly care plan.</EmptyState>
      ) : (
        <div className="space-y-4">
          {subs.map((s) => (
            <Card key={s.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2"><p className="font-semibold text-fg">{s.plan_name}</p><StatusBadge status={s.status} /></div>
                <p className="mt-1 text-sm text-muted">{formatMYR(s.price_cents)}/month</p>
                {s.current_period_end && ["active", "trialing", "past_due"].includes(s.status) && (
                  <p className="text-xs text-subtle">{s.cancel_at_period_end ? `Ends on ${formatDate(s.current_period_end)}` : `Renews on ${formatDate(s.current_period_end)}`}</p>
                )}
                {s.status === "past_due" && <p className="mt-1 text-xs text-red-300">Payment failed — please update your payment method.</p>}
              </div>
              {["active", "trialing", "past_due"].includes(s.status) && <SubscriptionToggle subscriptionId={s.id} cancelAtPeriodEnd={s.cancel_at_period_end} />}
            </Card>
          ))}
        </div>
      )}
      <div className="mt-10"><SectionTitle>Available plans</SectionTitle></div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="flex flex-col">
            <p className="font-semibold text-fg">{p.name}</p>
            <p className="mt-1 text-2xl font-semibold text-fg">{priceLabel(p)}</p>
            <ul className="mt-3 flex-1 space-y-1.5 text-sm text-muted">{p.deliverables.slice(0, 4).map((d) => <li key={d}>• {d}</li>)}</ul>
            {activeServiceIds.has(p.id) ? (
              <p className="mt-4 text-sm text-emerald-300">Your current plan</p>
            ) : (
              <ButtonLink href={`/order/${p.slug}`} className="mt-4" size="sm">Subscribe</ButtonLink>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
