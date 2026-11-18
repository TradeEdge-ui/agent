"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { IconMenu, IconX } from "@/components/icons";
import * as Icons from "@/components/icons";

export type NavItem = { href: string; label: string; icon: keyof typeof Icons; exact?: boolean };

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="mt-2 flex flex-col gap-0.5" aria-label="Dashboard">
      {items.map((item) => {
        const Icon = Icons[item.icon];
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              active ? "bg-brand-500/15 text-fg ring-1 ring-brand-400/20" : "text-muted hover:bg-white/[0.04] hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close the drawer after navigation (adjust state during render, no effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  return (
    <>
      <button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-fg" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}>
        <IconMenu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/60" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r border-white/10 bg-ink-900 p-4">
            <div className="flex justify-end">
              <button className="grid h-10 w-10 place-items-center rounded-lg text-fg" aria-label="Close navigation" onClick={() => setOpen(false)}>
                <IconX className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav items={items} />
            <form action="/auth/signout" method="post" className="mt-4 border-t border-white/10 pt-4">
              <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:text-fg">Sign out</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
