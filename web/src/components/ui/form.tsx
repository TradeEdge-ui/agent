import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 text-sm text-fg placeholder:text-subtle transition focus:border-brand-400/60 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-60";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-fg", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(field, "min-h-24 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(field, "h-11 appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return <input type="checkbox" className={cn("mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-ink-900 accent-brand-500", className)} {...props} />;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-red-300">{message}</p>;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-subtle">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

/** Invisible honeypot field for spam bots. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label htmlFor="website_hp">Leave this field empty</label>
      <input id="website_hp" name="website_hp" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
