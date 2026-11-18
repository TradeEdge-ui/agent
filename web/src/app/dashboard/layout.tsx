import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import type { NavItem } from "@/components/app/nav";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Always per-request: these pages depend on the signed-in user.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Client portal", robots: { index: false, follow: false } };

const nav: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "IconHome", exact: true },
  { href: "/dashboard/requests", label: "Requests", icon: "IconInbox" },
  { href: "/dashboard/quotes", label: "Quotations", icon: "IconFile" },
  { href: "/dashboard/projects", label: "Projects", icon: "IconFolder" },
  { href: "/dashboard/invoices", label: "Invoices & payments", icon: "IconReceipt" },
  { href: "/dashboard/subscriptions", label: "Care plans", icon: "IconRepeat" },
  { href: "/dashboard/files", label: "Files", icon: "IconBriefcase" },
  { href: "/dashboard/bookings", label: "Consultations", icon: "IconCalendar" },
  { href: "/dashboard/profile", label: "Profile", icon: "IconUser" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/dashboard");
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  return (
    <AppShell user={user} nav={nav} unread={count ?? 0} area="client">
      {children}
    </AppShell>
  );
}
