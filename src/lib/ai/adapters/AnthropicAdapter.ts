// src/lib/ai/adapters/AnthropicAdapter.ts
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

export class AnthropicAdapter implements AiProviderAdapter {
  readonly providerId: AiProviderId = "anthropic";

  private getEffectiveKey(credentials: ProviderCredentials): string {
    return credentials.apiKey || process.env.ANTHROPIC_API_KEY || "";
  }

  private getBaseUrl(credentials: ProviderCredentials): string {
    return (credentials.baseUrl || "https://api.anthropic.com/v1").replace(/\/+$/, "");
  }

  async testConnection(
    credentials: ProviderCredentials,
    modelId: string = "claude-3-5-haiku-latest"
  ): Promise<ProviderTestResult> {
    const key = this.getEffectiveKey(credentials);
    if (!key) {
      return {
        ok: false,
        status: 400,
        latencyMs: 0,
        modelUsed: modelId,
        message: "Missing Anthropic API Key.",
        error: "Missing API Key",
      };
    }

    const base = this.getBaseUrl(credentials);
    const start = Date.now();

    try {
      const res = await fetchWithSafeEgress(`${base}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
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
          message: `Anthropic error (${res.status}): ${errMsg}`,
          error: errMsg,
        };
      }

      const data = await res.json();
      const reply = data.content?.[0]?.text?.trim() || "Active";
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

  async discoverModels(): Promise<DiscoveredModel[]> {
    // Anthropic recommended models
    return [
      {
        id: "claude-3-5-haiku-latest",
        name: "Claude 3.5 Haiku",
        provider: "anthropic",
        supportsVision: true,
        supportsEmbedding: false,
        description: "Fastest, low-cost Claude model for real-time tasks.",
      },
      {
        id: "claude-3-5-sonnet-latest",
        name: "Claude 3.5 Sonnet",
        provider: "anthropic",
        supportsVision: true,
        supportsEmbedding: false,
        description: "Flagship intelligence for code, reasoning, and multimodal inputs.",
      },
    ];
  }

  async generate(
    req: AiGenerateRequest,
    credentials: ProviderCredentials
  ): Promise<AiGenerateResponse> {
    const key = this.getEffectiveKey(credentials);
    if (!key) throw new Error("Missing Anthropic API Key.");

    const base = this.getBaseUrl(credentials);
    const start = Date.now();

    const bodyPayload: Record<string, unknown> = {
      model: req.modelId,
      messages: [{ role: "user", content: req.prompt }],
      max_tokens: req.maxOutputTokens ?? 2048,
      temperature: req.temperature ?? 0.2,
    };

    if (req.systemInstruction) {
      bodyPayload.system = req.systemInstruction;
    }

    const res = await fetchWithSafeEgress(`${base}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(req.timeoutMs || 25000),
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let errMsg = errText;
      try {
        errMsg = JSON.parse(errText).error?.message || errText;
      } catch {}
      const errorObj = new Error(`Anthropic API ${res.status}: ${errMsg}`);
      (errorObj as unknown as { status: number }).status = res.status;
      throw errorObj;
    }

    const data = await res.json();
    return {
      text: data.content?.[0]?.text?.trim() || "",
      model: req.modelId,
      provider: "anthropic",
      latencyMs,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens ?? 0,
            completionTokens: data.usage.output_tokens ?? 0,
            totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          }
        : null,
      finishReason: data.stop_reason || null,
    };
  }
}
