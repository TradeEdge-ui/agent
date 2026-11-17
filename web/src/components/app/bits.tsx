import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("h-2 w-full rounded-full bg-white/[0.06]", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-cyan-glow transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

export function SearchParamAlerts({ messages }: { messages: Array<{ when: boolean; tone: "success" | "danger" | "info" | "warning"; text: ReactNode }> }) {
  const tones = {
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    danger: "border-red-400/30 bg-red-500/10 text-red-200",
    info: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    warning: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  };
  const shown = messages.filter((m) => m.when);
  if (!shown.length) return null;
  return (
    <div className="mb-6 space-y-2">
      {shown.map((m, i) => (
        <div key={i} role="status" className={cn("rounded-xl border px-4 py-3 text-sm", tones[m.tone])}>{m.text}</div>
      ))}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-fg">{children}</h2>
      {action}
    </div>
  );
}

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting deposit",
  planning: "Planning",
  in_progress: "In progress",
  review: "In review",
  completed: "Completed",
  on_hold: "On hold",
  cancelled: "Cancelled",
};
