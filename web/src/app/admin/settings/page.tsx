import { SettingsForm } from "@/components/admin/forms";
import { SectionTitle } from "@/components/app/bits";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { getBusinessSettings } from "@/lib/settings";
import { integrationStatus, env } from "@/lib/env";

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] py-2 last:border-b-0">
      <span className="text-fg">{label}</span>
      <span className="flex items-center gap-2 text-xs text-muted">{detail}<Badge tone={ok ? "success" : "warning"}>{ok ? "configured" : "missing"}</Badge></span>
    </li>
  );
}

export default async function AdminSettingsPage() {
  const settings = await getBusinessSettings();
  const s = integrationStatus();
  return (
    <>
      <PageHeader title="Settings" />
      <Card className="mb-8">
        <SectionTitle>Integrations</SectionTitle>
        <ul className="text-sm">
          <Row label="Database & auth (Supabase)" ok={s.supabase && s.supabaseServiceRole} detail="NEXT_PUBLIC_SUPABASE_URL, publishable key, SUPABASE_SECRET_KEY" />
          <Row label={`Payments (Stripe${s.stripe ? ` — ${s.stripeMode} mode` : ""})`} ok={s.stripe} detail="STRIPE_SECRET_KEY" />
          <Row label="Stripe webhook" ok={s.stripeWebhook} detail={`STRIPE_WEBHOOK_SECRET → ${env.siteUrl}/api/stripe/webhook`} />
          <Row label="Transactional email (Resend)" ok={s.email} detail="RESEND_API_KEY, EMAIL_FROM" />
          <Row label="Owner email alerts" ok={Boolean(env.adminNotificationEmail)} detail="ADMIN_NOTIFICATION_EMAIL" />
          <Row label="AI assistant (Anthropic)" ok={s.ai} detail={`ANTHROPIC_API_KEY · model ${s.aiModel}`} />
          <Row label="Daily automation (cron)" ok={s.cron} detail="CRON_SECRET" />
        </ul>
        <p className="mt-3 text-xs text-subtle">Keys are set as environment variables in your hosting provider (e.g. Vercel → Project → Settings → Environment Variables) and are never shown here.</p>
      </Card>
      <Card><SettingsForm settings={settings} /></Card>
    </>
  );
}
