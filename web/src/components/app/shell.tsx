import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { SidebarNav, MobileNav, type NavItem } from "@/components/app/nav";
import { IconBell, IconLogout } from "@/components/icons";
import type { SessionUser } from "@/lib/auth";

export function AppShell({
  user,
  nav,
  unread,
  area,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  unread: number;
  area: "client" | "admin";
  children: ReactNode;
}) {
  const notificationsHref = area === "admin" ? "/admin/notifications" : "/dashboard/notifications";
  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/60 px-4 py-5 lg:flex">
        <Logo href={area === "admin" ? "/admin" : "/dashboard"} />
        <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">{area === "admin" ? "Admin" : "Client portal"}</p>
        <SidebarNav items={nav} />
        <div className="mt-auto space-y-1 border-t border-white/[0.06] pt-4">
          <p className="truncate px-3 text-sm text-fg">{user.profile.full_name ?? user.email}</p>
          <p className="truncate px-3 text-xs text-subtle">{user.email}</p>
          <form action="/auth/signout" method="post">
            <button className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-white/[0.05] hover:text-fg">
              <IconLogout className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-white/[0.06] bg-ink-950/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <MobileNav items={nav} />
            <Logo href={area === "admin" ? "/admin" : "/dashboard"} />
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            {area === "admin" && user.profile.role === "admin" && (
              <Link href="/dashboard" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-fg sm:block">Client view</Link>
            )}
            {area === "client" && user.profile.role === "admin" && (
              <Link href="/admin" className="rounded-lg px-3 py-2 text-sm text-brand-300 hover:text-brand-200">Admin</Link>
            )}
            <Link href={notificationsHref} className="relative grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-white/[0.05] hover:text-fg" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
              <IconBell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>
              )}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
