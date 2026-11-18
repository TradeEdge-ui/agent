"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui/button";
import { IconMenu, IconX } from "@/components/icons";
import { mainNav } from "@/lib/config";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled || open ? "border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                pathname?.startsWith(item.href) ? "text-fg" : "text-muted hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className={buttonClass("ghost", "sm")}>
            Client login
          </Link>
          <Link href="/get-quote" className={buttonClass("primary", "sm")}>
            Get a quote
          </Link>
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg text-fg md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <IconX className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="border-t border-white/[0.06] px-4 pb-6 pt-2 md:hidden" aria-label="Mobile">
          <ul className="flex flex-col">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded-lg px-3 py-3 text-base text-fg hover:bg-white/[0.04]">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/book" className="block rounded-lg px-3 py-3 text-base text-fg hover:bg-white/[0.04]">
                Book a free consultation
              </Link>
            </li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/login" className={buttonClass("secondary", "md")}>
              Client login
            </Link>
            <Link href="/get-quote" className={buttonClass("primary", "md")}>
              Get a quote
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
