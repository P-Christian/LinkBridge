// src/lib/gemini/geminiMonitoring.ts
// Monitoring middleware — the ONLY gateway to Gemini for application features.
// Every call passes through here: captures latency, tokens, status, and writes
// telemetry to Directus fire-and-forget (never blocks the user response).

import { callGeminiRaw, type GeminiRawResult } from "./geminiClient";
import {
  getDecryptedProviderCredentials,
  isLocalAiOnlyMode,
  resolveWorkloadModel,
} from "@/lib/ai/aiConfigStore";
import { getProviderAdapter } from "@/lib/ai/adapters";

export type GeminiFeature =
  | "AI_RERANKER"
  | "MATCH_EXPLAINER"
  | "QUERY_UNDERSTANDING"
  | "BEST_MATCH"
  | "ROLE_INTELLIGENCE"
  | "AUTO_CREATE_JOB"
  | "REFINE_JOB_TEXT"
  | "COMPANY_PROFILE_AI"
  | "REFINE_COMPANY_TEXT"
  | "CAMPUS_MATCH_EXPLAINER"
  | "CAREER_ADVICE_AI";

export type GeminiRequestType = "TEXT" | "CHAT" | "EMBEDDING" | "IMAGE";
export type GeminiProvider = "GEMINI" | "OPENAI" | "ANTHROPIC" | "MISTRAL" | "OLLAMA";

interface MonitoringParams {
  prompt: string;
  feature: GeminiFeature;
  endpoint: string;
  requestType?: GeminiRequestType;
  provider?: GeminiProvider;
  userId?: number;
  companyId?: number;
  timeoutMs?: number;
}

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getDirectusHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

/** Generate a unique request correlation ID */
function generateRequestId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `req_${ts}_${rand}`;
}

/** Fire-and-forget: write a telemetry record to Directus vs_gemini_requests.
 *  Never throws — monitoring failures must never affect the user request. */
async function saveMonitoringRecord(record: Record<string, unknown>): Promise<void> {
  if (!DIRECTUS_BASE) {
    console.warn("[gemini-monitoring] ⚠️ DIRECTUS_BASE not configured — skipping telemetry write.");
    return;
  }

  const url = `${DIRECTUS_BASE}/items/vs_gemini_requests`;
  const res = await fetch(url, {
    method: "POST",
    headers: getDirectusHeaders(),
    body: JSON.stringify(record),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(
      `[gemini-monitoring] ❌ Failed to save telemetry to Directus (HTTP ${res.status}):`,
      errText || res.statusText
    );
  } else {
    console.log(`[gemini-monitoring] ✅ Successfully saved telemetry record: ${record.request_id}`);
  }
}

/**
 * Under local-only mode a prompt must never reach callGeminiRaw. Ollama is the
 * one self-hosted provider the telemetry schema can label (GeminiProvider has
 * no value for local_custom, which is left to fail closed).
 */
async function callOllama(
  modelId: string,
  prompt: string,
  timeoutMs?: number
): Promise<GeminiRawResult> {
  try {
    const res = await getProviderAdapter("ollama").generate(
      { modelId, prompt, timeoutMs, temperature: 0.2, maxOutputTokens: 2048 },
      getDecryptedProviderCredentials("ollama")
    );
    return {
      text: res.text,
      model: res.model,
      usageMetadata: res.usage
        ? {
            promptTokenCount: res.usage.promptTokens,
            candidatesTokenCount: res.usage.completionTokens,
            totalTokenCount: res.usage.totalTokens,
          }
        : null,
      finishReason: res.finishReason ?? "STOP",
      httpStatus: 200,
      timedOut: false,
      errorMessage: res.text ? null : "Local model returned an empty response.",
    };
  } catch (err) {
    return {
      text: "",
      model: modelId,
      usageMetadata: null,
      finishReason: "ERROR",
      httpStatus: 500,
      timedOut: false,
      errorMessage: (err as Error)?.message ?? "Local AI call failed.",
    };
  }
}

/**
 * callGeminiMonitored — the unified application entrypoint for all Gemini calls.
 *
 * Every AI feature in VOS Sync calls this wrapper instead of callGeminiSafe().
 * Returns the response text or null on failure — identical behavior to callGeminiSafe().
 * Writes telemetry asynchronously (fire-and-forget) to Directus gemini_requests.
 */
export async function callGeminiMonitored(params: MonitoringParams): Promise<string | null> {
  const {
    prompt,
    feature,
    endpoint,
    requestType = "TEXT",
    provider = "GEMINI",
    userId,
    companyId,
    timeoutMs,
  } = params;

  const requestId = generateRequestId();
  const startMs = Date.now();

  // Resolve assigned model and fallback for this specific feature
  const { primaryModel, fallbackModel } = resolveWorkloadModel(feature);

  const useOllama = isLocalAiOnlyMode() && primaryModel?.provider === "ollama";
  let providerName: GeminiProvider = provider;
  let result: GeminiRawResult;

  if (useOllama) {
    providerName = "OLLAMA";
    result = await callOllama(primaryModel.id, prompt, timeoutMs);
  } else {
    // Call Gemini — always awaited before telemetry write so latency is accurate
    result = await callGeminiRaw(
      prompt,
      timeoutMs,
      primaryModel?.id,
      fallbackModel?.id || undefined
    );
  }

  const latencyMs = Date.now() - startMs;

  // Determine response_status
  let responseStatus: "SUCCESS" | "ERROR" | "TIMEOUT";
  if (result.timedOut) {
    responseStatus = "TIMEOUT";
  } else if (result.errorMessage || !result.text) {
    responseStatus = "ERROR";
  } else {
    responseStatus = "SUCCESS";
  }

  if (result.errorMessage) {
    console.warn(`[gemini-monitoring] ⚠️ ${feature} — ${responseStatus}: ${result.errorMessage}`);
  }

  // Standard ISO timestamp for Directus DB persistence (Asia/Manila timezone handles display)
  const createdAt = new Date().toISOString();


  // Build telemetry record — raw facts only, no derived cost/billing fields
  const record: Record<string, unknown> = {
    request_id: requestId,
    provider: providerName,
    feature,
    request_type: requestType,
    endpoint,
    model: result.model,
    prompt_tokens: result.usageMetadata?.promptTokenCount ?? 0,
    completion_tokens: result.usageMetadata?.candidatesTokenCount ?? 0,
    total_tokens: result.usageMetadata?.totalTokenCount ?? 0,
    finish_reason: result.finishReason,
    response_status: responseStatus,
    latency_ms: latencyMs,
    status: result.httpStatus,
    error_message: result.errorMessage,
    created_at: createdAt,
  };

  // Attach user attribution if provided
  if (userId !== undefined) record["user_id"] = userId;
  if (companyId !== undefined) record["company_id"] = companyId;

  // Fire-and-forget — monitoring must never block or fail the user request
  void saveMonitoringRecord(record).catch((err: unknown) => {
    console.warn(
      "[gemini-monitoring] ⚠️ Failed to save telemetry record — Directus may be unavailable.",
      (err as Error)?.message ?? err
    );
  });

  return result.text || null;
}
