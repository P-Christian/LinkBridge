// src/lib/gemini/geminiClient.ts

import { isLocalAiOnlyMode } from "@/lib/ai/aiConfigStore";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const DEFAULT_GEMINI_TIMEOUT_MS = 12000;
const GEMINI_TIMEOUT_MS = DEFAULT_GEMINI_TIMEOUT_MS;

/**
 * The key travels in a header — query strings are logged by proxies and
 * error reporters.
 */
function geminiHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": GEMINI_API_KEY,
  };
}

/** Local-only mode must stop candidate PII from reaching a cloud processor. */
function cloudBlockReason(): string | null {
  if (!GEMINI_API_KEY) return "GEMINI_API_KEY is not set in environment.";
  if (isLocalAiOnlyMode()) return "Cloud AI is disabled by the local-only AI setting.";
  return null;
}

export interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface GeminiRawResult {
  text: string;
  model: string;
  usageMetadata: GeminiUsageMetadata | null;
  finishReason: string | null;
  httpStatus: number;
  timedOut: boolean;
  errorMessage: string | null;
}

/**
 * Internal raw call — returns the full GCP response including usageMetadata and finishReason.
 * Used exclusively by the monitoring middleware (geminiMonitoring.ts).
 * Supports model override and automatic bounded failover on HTTP 429.
 */
export async function callGeminiRaw(
  prompt: string,
  timeoutMs: number = DEFAULT_GEMINI_TIMEOUT_MS,
  modelOverride?: string,
  fallbackModel?: string
): Promise<GeminiRawResult> {
  const activeModel = modelOverride || GEMINI_MODEL;

  const blocked = cloudBlockReason();
  if (blocked) {
    return {
      text: "",
      model: activeModel,
      usageMetadata: null,
      finishReason: "ERROR",
      httpStatus: 0,
      timedOut: false,
      errorMessage: blocked,
    };
  }

  const url = `${GEMINI_BASE}/v1beta/models/${activeModel}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: geminiHeaders(),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const httpStatus = res.status;

    // Failover on Rate Limit (429) or Service Unavailable (503) if fallback model is configured
    if ((httpStatus === 429 || httpStatus === 503) && fallbackModel && fallbackModel !== activeModel) {
      console.warn(
        `[geminiClient] 🔄 HTTP ${httpStatus} on ${activeModel}. Failing over to backup model: ${fallbackModel}`
      );
      return await callGeminiRaw(prompt, timeoutMs, fallbackModel, undefined);
    }

    if (!res.ok) {
      const body = await res.text();
      return {
        text: "",
        model: activeModel,
        usageMetadata: null,
        finishReason: "ERROR",
        httpStatus,
        timedOut: false,
        errorMessage: `Gemini API error ${httpStatus}: ${body.slice(0, 300)}`,
      };
    }

    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const finishReason: string | null = json?.candidates?.[0]?.finishReason ?? null;
    const rawUsage = json?.usageMetadata ?? null;
    const usageMetadata: GeminiUsageMetadata | null = rawUsage
      ? {
          promptTokenCount: rawUsage.promptTokenCount ?? 0,
          candidatesTokenCount: rawUsage.candidatesTokenCount ?? 0,
          totalTokenCount: rawUsage.totalTokenCount ?? 0,
        }
      : null;

    return {
      text: text.trim(),
      model: activeModel,
      usageMetadata,
      finishReason,
      httpStatus,
      timedOut: false,
      errorMessage: null,
    };
  } catch (err) {
    clearTimeout(timeout);
    const timedOut = (err as Error)?.name === "AbortError";

    // Attempt failover on timeout if fallback is provided
    if (timedOut && fallbackModel && fallbackModel !== activeModel) {
      console.warn(`[geminiClient] ⏱️ Timeout on ${activeModel}. Failing over to backup model: ${fallbackModel}`);
      return await callGeminiRaw(prompt, timeoutMs, fallbackModel, undefined);
    }

    return {
      text: "",
      model: activeModel,
      usageMetadata: null,
      finishReason: timedOut ? "TIMEOUT" : "ERROR",
      httpStatus: timedOut ? 408 : 500,
      timedOut,
      errorMessage: timedOut
        ? `Request timed out after ${timeoutMs}ms`
        : ((err as Error)?.message ?? "Unknown error"),
    };
  }
}

export async function callGemini(prompt: string): Promise<string> {
  const blocked = cloudBlockReason();
  if (blocked) throw new Error(blocked);

  const url = `${GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: geminiHeaders(),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text();
      console.error(`[gemini] ❌ API error ${res.status}:`, body.slice(0, 300));
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return text.trim();
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error)?.name === "AbortError") {
      console.error(`[gemini] ⏱️  Request timed out after ${GEMINI_TIMEOUT_MS}ms`);
    }
    throw err;
  }
}

/** Safe wrapper — returns null instead of throwing on any failure */
export async function callGeminiSafe(prompt: string): Promise<string | null> {
  try {
    return await callGemini(prompt);
  } catch (err) {
    console.warn("[gemini] ⚠️  callGeminiSafe caught error:", (err as Error)?.message ?? err);
    return null;
  }
}

/** 
 * Multimodal call for uploading a file + text prompt.
 * Accepts base64 encoded data and a mimeType.
 */
export async function callGeminiWithFile(prompt: string, base64Data: string, mimeType: string): Promise<string> {
  const blocked = cloudBlockReason();
  if (blocked) throw new Error(blocked);

  const url = `${GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const controller = new AbortController();
  // Extending timeout for file processing if needed
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS * 2);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: geminiHeaders(),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text();
      console.error(`[gemini] ❌ API error ${res.status}:`, body.slice(0, 300));
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return text.trim();
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error)?.name === "AbortError") {
      console.error(`[gemini] ⏱️  Request timed out after ${GEMINI_TIMEOUT_MS * 2}ms`);
    }
    throw err;
  }
}
