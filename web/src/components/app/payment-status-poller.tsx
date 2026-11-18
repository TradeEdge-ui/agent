"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * After returning from Stripe we do NOT assume success. We refresh until the
 * verified webhook has marked the invoice paid (or give up after ~1 minute).
 */
export function PaymentStatusPoller({ paid }: { paid: boolean }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (paid || tries >= 12) return;
    const t = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, 5000);
    return () => clearTimeout(t);
  }, [paid, tries, router]);
  if (paid) return null;
  return (
    <p className="text-xs text-subtle">
      {tries < 12 ? "Checking payment status…" : "Still waiting for confirmation. This page will update once your bank confirms — you'll also get an email."}
    </p>
  );
}
