// src/lib/ai/adapters/GoogleGeminiAdapter.ts
import { fetchWithSafeEgress } from "../egress";
import {
  AiProviderAdapter,
  AiProviderId,
  DiscoveredModel,
  ProviderCredentials,
  ProviderTestResult,
  AiGenerateRequest,
  AiGenerateResponse,
} from "../types";

export class GoogleGeminiAdapter implements AiProviderAdapter {
  readonly providerId: AiProviderId = "google";

  private getEffectiveKey(credentials: ProviderCredentials): string {
    return credentials.apiKey || process.env.GEMINI_API_KEY || "";
  }

  /** Key in a header only — query strings are captured by proxy and error-reporter logs. */
  private authHeaders(key: string): Record<string, string> {
    return { "Content-Type": "application/json", "x-goog-api-key": key };
  }

  async testConnection(
    credentials: ProviderCredentials,
    modelId: string = "gemini-3.5-flash-lite"
  ): Promise<ProviderTestResult> {
    const key = this.getEffectiveKey(credentials);
    if (!key) {
      return {
        ok: false,
        status: 400,
        latencyMs: 0,
        modelUsed: modelId,
        message: "No Gemini API key provided or found in environment.",
        error: "Missing API Key",
      };
    }

    const cleanModel = modelId.replace(/^models\//, "");
    const base = credentials.baseUrl || "https://generativelanguage.googleapis.com";
    const url = `${base}/v1beta/models/${cleanModel}:generateContent`;
    const start = Date.now();

    try {
      const res = await fetchWithSafeEgress(url, {
        method: "POST",
        headers: this.authHeaders(key),
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Ping: Respond 'Active' in one word." }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
        signal: AbortSignal.timeout(6000),
      });

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let errMsg = errText;
        try {
          const j = JSON.parse(errText);
          errMsg = j.error?.message || errText;
        } catch {}
        return {
          ok: false,
          status: res.status,
          latencyMs,
          modelUsed: cleanModel,
          message: `Google Gemini error (${res.status}): ${errMsg}`,
          error: errMsg,
        };
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Active";
      return {
        ok: true,
        status: 200,
        latencyMs,
        modelUsed: cleanModel,
        message: `Success: connected in ${latencyMs}ms. Response: "${reply}"`,
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        latencyMs: Date.now() - start,
        modelUsed: cleanModel,
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async discoverModels(credentials: ProviderCredentials): Promise<DiscoveredModel[]> {
    const key = this.getEffectiveKey(credentials);
    if (!key) return [];

    const base = credentials.baseUrl || "https://generativelanguage.googleapis.com";
    const url = `${base}/v1beta/models`;

    try {
      const res = await fetchWithSafeEgress(url, {
        headers: { "x-goog-api-key": key },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const models = data.models || [];

      return models
        .filter((m: { supportedGenerationMethods?: string[] }) =>
          m.supportedGenerationMethods?.some((method: string) =>
            ["generateContent", "embedContent"].includes(method)
          )
        )
        .map((m: {
          name: string;
          displayName?: string;
          inputTokenLimit?: number;
          outputTokenLimit?: number;
          description?: string;
          supportedGenerationMethods?: string[];
        }) => {
          const cleanId = m.name.replace(/^models\//, "");
          const isEmbed = m.supportedGenerationMethods?.includes("embedContent") ?? false;
          return {
            id: cleanId,
            name: m.displayName || cleanId,
            provider: "google" as AiProviderId,
            inputTokenLimit: m.inputTokenLimit,
            outputTokenLimit: m.outputTokenLimit,
            supportsVision: !isEmbed && !cleanId.includes("tts") && !cleanId.includes("transcribe"),
            supportsEmbedding: isEmbed,
            description: m.description,
          };
        });
    } catch {
      return [];
    }
  }

  async generate(
    req: AiGenerateRequest,
    credentials: ProviderCredentials
  ): Promise<AiGenerateResponse> {
    const key = this.getEffectiveKey(credentials);
    if (!key) throw new Error("Missing Gemini API Key.");

    const cleanModel = req.modelId.replace(/^models\//, "");
    const base = credentials.baseUrl || "https://generativelanguage.googleapis.com";
    const url = `${base}/v1beta/models/${cleanModel}:generateContent`;
    const start = Date.now();

    const bodyPayload: Record<string, unknown> = {
      contents: [{ parts: [{ text: req.prompt }] }],
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxOutputTokens ?? 2048,
      },
    };

    if (req.systemInstruction) {
      bodyPayload.systemInstruction = {
        parts: [{ text: req.systemInstruction }],
      };
    }

    const res = await fetchWithSafeEgress(url, {
      method: "POST",
      headers: this.authHeaders(key),
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(req.timeoutMs || 15000),
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let parsedMsg = errText;
      try {
        parsedMsg = JSON.parse(errText).error?.message || errText;
      } catch {}
      const errorObj = new Error(`Gemini API ${res.status}: ${parsedMsg}`);
      (errorObj as unknown as { status: number }).status = res.status;
      throw errorObj;
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text?.trim() || "";
    const finishReason = candidate?.finishReason || null;
    const usageRaw = data.usageMetadata;

    return {
      text,
      model: cleanModel,
      provider: "google",
      latencyMs,
      usage: usageRaw
        ? {
            promptTokens: usageRaw.promptTokenCount ?? 0,
            completionTokens: usageRaw.candidatesTokenCount ?? 0,
            totalTokens: usageRaw.totalTokenCount ?? 0,
          }
        : null,
      finishReason,
    };
  }
}
