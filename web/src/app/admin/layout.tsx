import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import type { NavItem } from "@/components/app/nav";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Always per-request: these pages depend on the signed-in user.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const nav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "IconChart", exact: true },
  { href: "/admin/leads", label: "Leads", icon: "IconInbox" },
  { href: "/admin/clients", label: "Clients", icon: "IconUsers" },
  { href: "/admin/quotes", label: "Quotations", icon: "IconFile" },
  { href: "/admin/projects", label: "Projects", icon: "IconFolder" },
  { href: "/admin/invoices", label: "Invoices", icon: "IconReceipt" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "IconRepeat" },
  { href: "/admin/finance", label: "Revenue & expenses", icon: "IconCard" },
  { href: "/admin/bookings", label: "Consultations", icon: "IconCalendar" },
  { href: "/admin/ai", label: "AI assistant", icon: "IconSparkles" },
  { href: "/admin/services", label: "Services & pricing", icon: "IconBriefcase" },
  { href: "/admin/portfolio", label: "Portfolio", icon: "IconRocket" },
  { href: "/admin/testimonials", label: "Testimonials", icon: "IconStar" },
  { href: "/admin/notifications", label: "Notifications", icon: "IconBell" },
  { href: "/admin/settings", label: "Settings", icon: "IconSettings" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
  return (
    <AppShell user={user} nav={nav} unread={count ?? 0} area="admin">
      {children}
    </AppShell>
  );
}
