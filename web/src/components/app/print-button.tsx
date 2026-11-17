"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => window.print()} className="no-print">
      {label}
    </Button>
  );
}
