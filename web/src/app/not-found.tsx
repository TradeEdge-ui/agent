import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div>
        <p className="text-sm font-semibold text-brand-300">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-fg">Page not found</h1>
        <p className="mt-3 text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className={buttonClass("primary")}>Go home</Link>
          <Link href="/contact" className={buttonClass("secondary")}>Contact us</Link>
        </div>
      </div>
    </main>
  );
}
