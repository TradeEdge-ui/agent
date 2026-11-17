"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Wraps a server action with pending/error/success handling. `children` may be
 * a render function receiving field errors.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  successContent,
  hideMessage = false,
}: {
  action: Action;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  successContent?: (state: ActionState) => ReactNode;
  hideMessage?: boolean;
}) {
  const [state, formAction] = useActionState(action, { ok: false });
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  if (state.ok && successContent) return <>{successContent(state)}</>;

  return (
    <form ref={ref} action={formAction} className={className} noValidate>
      {typeof children === "function" ? children(state) : children}
      {!hideMessage && state.message && (
        <Alert tone={state.ok ? "success" : "danger"} className="mt-4">
          {state.message}
        </Alert>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingText = "Working…",
  variant = "primary",
  size = "md",
  className,
  confirm,
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      aria-busy={pending}
      name={name}
      value={value}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </Button>
  );
}
