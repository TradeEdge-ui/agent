import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("glass rounded-2xl p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-base font-semibold text-fg", className)} {...props} />;
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-muted border-white/10",
  brand: "bg-brand-500/15 text-brand-300 border-brand-400/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  danger: "bg-red-500/15 text-red-300 border-red-400/30",
  info: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}

const STATUS_TONES: Record<string, Tone> = {
  new: "info", contacted: "brand", qualified: "brand", proposal_sent: "warning", won: "success", lost: "neutral",
  draft: "neutral", sent: "info", accepted: "success", declined: "danger", expired: "neutral", cancelled: "neutral",
  awaiting_payment: "warning", planning: "info", in_progress: "brand", review: "warning", completed: "success", on_hold: "neutral",
  open: "warning", paid: "success", void: "neutral", uncollectible: "danger",
  active: "success", trialing: "info", past_due: "danger", canceled: "neutral", unpaid: "danger", incomplete: "warning", incomplete_expired: "neutral", paused: "neutral",
  confirmed: "success", no_show: "danger",
  pending: "neutral", done: "success", rejected: "neutral",
  succeeded: "success", refunded: "neutral", partially_refunded: "warning",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{label ?? status.replaceAll("_", " ")}</Badge>;
}

const alertTones: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/[0.04] text-muted",
  brand: "border-brand-400/30 bg-brand-500/10 text-brand-200",
  success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  warning: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  danger: "border-red-400/30 bg-red-500/10 text-red-200",
  info: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
};

export function Alert({ tone = "neutral", title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", alertTones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && "mt-1", "leading-relaxed")}>{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
      <p className="font-medium text-fg">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <div className="mt-1.5 text-sm text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", tone === "good" && "text-emerald-300", tone === "bad" && "text-red-300")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("glass overflow-x-auto rounded-2xl", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-white/[0.06] px-4 py-3 text-xs font-medium uppercase tracking-wider text-subtle", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-white/[0.04] px-4 py-3 align-top text-muted", className)}>{children}</td>;
}

export function DefinitionList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[180px_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-subtle">{k}</dt>
          <dd className="text-fg break-words">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
