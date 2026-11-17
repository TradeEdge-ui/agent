"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClass } from "@/components/ui/button";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Something went wrong</h1>
        <p className="mt-3 max-w-md text-muted">Please try again. If the problem continues, contact us{error.digest ? ` and quote reference ${error.digest}` : ""}.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/" className={buttonClass("secondary")}>Go home</Link>
        </div>
      </div>
    </main>
  );
}
