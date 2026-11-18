import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isAiConfigured } from "@/lib/ai/client";
import { getTask } from "@/lib/ai/tasks";
import { buildContext, runStructured, runText } from "@/lib/ai/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  task: z.string().max(60),
  context_type: z.enum(["lead", "project", "client", "quote", "none"]),
  context_id: z.uuid().nullable().optional(),
  instructions: z.string().max(8000).default(""),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(40000) })).max(20).default([]),
});

/**
 * Admin-only AI assistant. It has no tools and cannot change any data: it only
 * returns drafts. Every call is logged to ai_logs for cost and audit review.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!isAiConfigured()) return Response.json({ error: "AI is not configured. Add ANTHROPIC_API_KEY in your environment variables." }, { status: 503 });
  if (!(await rateLimit(`ai:${user.id}`, 60, 3600))) return Response.json({ error: "AI rate limit reached (60/hour)." }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const body = parsed.data;
  const task = getTask(body.task);
  if (!task) return Response.json({ error: "Unknown task" }, { status: 400 });
  if (!task.context.includes(body.context_type)) return Response.json({ error: `Choose a ${task.context.join(" or ")} for this task.` }, { status: 400 });

  const admin = createAdminClient();
  let context = "";
  try {
    context = await buildContext(admin, body.context_type, body.context_id ?? null);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Context not found" }, { status: 404 });
  }
  const { data: svc } = await admin.from("services").select("*").eq("is_active", true).order("sort_order");
  const services = (svc ?? []) as Service[];
  const contextRef = body.context_id ? `${body.context_type}:${body.context_id}` : null;

  if (task.output !== "text") {
    try {
      const result = await runStructured(task, services, context, body.instructions);
      if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
      const { data: log } = await admin
        .from("ai_logs")
        .insert({ user_id: user.id, task: task.id, context_ref: contextRef, model: result.model, input_tokens: result.usage.input, output_tokens: result.usage.output, output: JSON.stringify(result.data) })
        .select("id")
        .single();
      return Response.json({ kind: result.kind, data: result.data, log_id: log?.id ?? null });
    } catch (e) {
      console.error("AI structured task failed", e);
      return Response.json({ error: "The AI request failed. Please try again." }, { status: 502 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let output = "";
      try {
        const gen = runText(task, services, context, body.instructions, body.history);
        let next = await gen.next();
        while (!next.done) {
          output += next.value;
          controller.enqueue(encoder.encode(next.value));
          next = await gen.next();
        }
        const usage = next.value;
        await admin.from("ai_logs").insert({
          user_id: user.id, task: task.id, context_ref: contextRef, model: usage.model,
          input_tokens: usage.input, output_tokens: usage.output, output: output.slice(0, 50000),
        });
      } catch (e) {
        console.error("AI stream failed", e);
        controller.enqueue(encoder.encode("\n\n[The AI request failed. Please try again.]"));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
