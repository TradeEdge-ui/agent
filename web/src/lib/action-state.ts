import type { z } from "zod";

/** Uniform result for server actions used with useActionState. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: Record<string, unknown>;
};

export const initialActionState: ActionState = { ok: false };

export function fail(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, message, fieldErrors };
}

export function succeed(message?: string, data?: Record<string, unknown>): ActionState {
  return { ok: true, message, data };
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") obj[k] = v;
  }
  return obj;
}

/** Postgres/PostgREST errors raised by our SQL functions carry user-safe text. */
export function dbErrorMessage(err: { message?: string } | null | undefined, fallback = "Something went wrong. Please try again."): string {
  const msg = err?.message ?? "";
  if (!msg) return fallback;
  // Hide internal details such as constraint names or SQL fragments.
  if (/violates|constraint|syntax|relation|column|permission denied|JWT/i.test(msg)) return fallback;
  return msg.length > 300 ? fallback : msg;
}
