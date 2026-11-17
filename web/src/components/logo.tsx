import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="ARyzz AI Solutions home">
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-cyan-glow shadow-lg shadow-brand-600/30">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20 12 4l8 16" />
          <path d="M7.5 13h9" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-fg">
        ARyzz <span className="text-muted font-normal">AI Solutions</span>
      </span>
    </Link>
  );
}
