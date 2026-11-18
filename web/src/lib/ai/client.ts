import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

let _client: Anthropic | null = null;

export function isAiConfigured() {
  return Boolean(env.anthropicApiKey);
}

export function getAnthropic(): Anthropic {
  if (!env.anthropicApiKey) throw new Error("AI assistant is not configured (ANTHROPIC_API_KEY).");
  if (!_client) _client = new Anthropic({ apiKey: env.anthropicApiKey, maxRetries: 2 });
  return _client;
}

/** Beta flag for server-side refusal fallbacks (fallbacks: "default"). */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;
