// src/lib/ai/adapters/OpenAiAdapter.ts
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

export class OpenAiAdapter implements AiProviderAdapter {
  readonly providerId: AiProviderId;
  private readonly defaultBaseUrl: string;

  constructor(providerId: AiProviderId = "openai", defaultBaseUrl: string = "https://api.openai.com/v1") {
    this.providerId = providerId;
    this.defaultBaseUrl = defaultBaseUrl;
  }

  private getEffectiveKey(credentials: ProviderCredentials): string {
    if (credentials.apiKey) return credentials.apiKey;
    if (this.providerId === "openai") return process.env.OPENAI_API_KEY || "";
    if (this.providerId === "mistral") return process.env.MISTRAL_API_KEY || "";
    return "";
  }

  private getBaseUrl(credentials: ProviderCredentials): string {
    return (credentials.baseUrl || this.defaultBaseUrl).replace(/\/+$/, "");
  }

  async testConnection(
    credentials: ProviderCredentials,
    modelId: string = this.providerId === "mistral" ? "mistral-small-latest" : "gpt-4o-mini"
  ): Promise<ProviderTestResult> {
    const key = this.getEffectiveKey(credentials);
    if (!key) {
      return {
        ok: false,
        status: 400,
        latencyMs: 0,
        modelUsed: modelId,
        message: `Missing ${this.providerId.toUpperCase()} API Key.`,
        error: "Missing API Key",
      };
    }

    const base = this.getBaseUrl(credentials);
    const start = Date.now();

    try {
      const res = await fetchWithSafeEgress(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: "Ping: Respond 'Active' in one word." }],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(7000),
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
          modelUsed: modelId,
          message: `${this.providerId.toUpperCase()} error (${res.status}): ${errMsg}`,
          error: errMsg,
        };
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || "Active";
      return {
        ok: true,
        status: 200,
        latencyMs,
        modelUsed: modelId,
        message: `Connected successfully in ${latencyMs}ms. Response: "${reply}"`,
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        latencyMs: Date.now() - start,
        modelUsed: modelId,
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async discoverModels(credentials: ProviderCredentials): Promise<DiscoveredModel[]> {
    const key = this.getEffectiveKey(credentials);
    if (!key) return [];
    const base = this.getBaseUrl(credentials);

    try {
      const res = await fetchWithSafeEgress(`${base}/models`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const models = data.data || [];

      return models
        .filter((m: { id: string }) => !m.id.includes("whisper") && !m.id.includes("dall-e"))
        .slice(0, 30)
        .map((m: { id: string }) => ({
          id: m.id,
          name: m.id,
          provider: this.providerId,
          supportsVision: m.id.includes("4o") || m.id.includes("vision"),
          supportsEmbedding: m.id.includes("embed"),
        }));
    } catch {
      return [];
    }
  }

  async generate(
    req: AiGenerateRequest,
    credentials: ProviderCredentials
  ): Promise<AiGenerateResponse> {
    const key = this.getEffectiveKey(credentials);
    if (!key) throw new Error(`Missing ${this.providerId.toUpperCase()} API Key.`);

    const base = this.getBaseUrl(credentials);
    const start = Date.now();

    const messages = [];
    if (req.systemInstruction) {
      messages.push({ role: "system", content: req.systemInstruction });
    }
    messages.push({ role: "user", content: req.prompt });

    const res = await fetchWithSafeEgress(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: req.modelId,
        messages,
        temperature: req.temperature ?? 0.2,
        max_tokens: req.maxOutputTokens ?? 2048,
      }),
      signal: AbortSignal.timeout(req.timeoutMs || 20000),
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let errMsg = errText;
      try {
        errMsg = JSON.parse(errText).error?.message || errText;
      } catch {}
      const errorObj = new Error(`${this.providerId.toUpperCase()} API ${res.status}: ${errMsg}`);
      (errorObj as unknown as { status: number }).status = res.status;
      throw errorObj;
    }

    const data = await res.json();
    const choice = data.choices?.[0];

    return {
      text: choice?.message?.content?.trim() || "",
      model: req.modelId,
      provider: this.providerId,
      latencyMs,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : null,
      finishReason: choice?.finish_reason || null,
    };
  }
}
