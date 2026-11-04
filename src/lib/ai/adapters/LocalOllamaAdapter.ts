// src/lib/ai/adapters/LocalOllamaAdapter.ts
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

export class LocalOllamaAdapter implements AiProviderAdapter {
  readonly providerId: AiProviderId = "ollama";

  private getBaseUrl(credentials: ProviderCredentials): string {
    const raw = credentials.baseUrl || process.env.LOCAL_AI_BASE_URL || "http://127.0.0.1:11434";
    return raw.replace(/\/+$/, "");
  }

  async testConnection(
    credentials: ProviderCredentials,
    modelId: string = "llama3.2:latest"
  ): Promise<ProviderTestResult> {
    const base = this.getBaseUrl(credentials);
    const start = Date.now();

    try {
      // First check Ollama ping / version
      const versionRes = await fetchWithSafeEgress(`${base}/api/version`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!versionRes.ok) {
        return {
          ok: false,
          status: versionRes.status,
          latencyMs: Date.now() - start,
          modelUsed: modelId,
          message: `Local server responded with HTTP ${versionRes.status}`,
          error: "Server Error",
        };
      }

      // Check tags to see available models
      const tagsRes = await fetchWithSafeEgress(`${base}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      const tagsData = await tagsRes.json().catch(() => ({ models: [] }));
      const availableModels: string[] = (tagsData.models || []).map((m: { name: string }) => m.name);

      const targetModel = availableModels.includes(modelId)
        ? modelId
        : availableModels[0] || modelId;

      // Fast generate ping
      const genRes = await fetchWithSafeEgress(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: targetModel,
          prompt: "Say Active in one word.",
          stream: false,
          options: { num_predict: 8 },
        }),
        signal: AbortSignal.timeout(6000),
      });

      const latencyMs = Date.now() - start;

      if (!genRes.ok) {
        return {
          ok: false,
          status: genRes.status,
          latencyMs,
          modelUsed: targetModel,
          message: `Local Ollama ping failed (${genRes.status}). Ensure model '${targetModel}' is pulled.`,
          error: `HTTP ${genRes.status}`,
        };
      }

      const genData = await genRes.json().catch(() => ({}));
      const reply = genData.response?.trim() || "Active";

      return {
        ok: true,
        status: 200,
        latencyMs,
        modelUsed: targetModel,
        message: `Connected to Local Ollama (${latencyMs}ms). Installed models: ${availableModels.length}. Response: "${reply}"`,
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        latencyMs: Date.now() - start,
        modelUsed: modelId,
        message: `Local AI is unreachable at ${base}. Ensure Ollama is running ('ollama serve').`,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async discoverModels(credentials: ProviderCredentials): Promise<DiscoveredModel[]> {
    const base = this.getBaseUrl(credentials);
    try {
      const res = await fetchWithSafeEgress(`${base}/api/tags`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return [];
      const data = await res.json();
      const models = data.models || [];

      return models.map((m: { name: string; details?: { family?: string; parameter_size?: string } }) => ({
        id: m.name,
        name: `Ollama: ${m.name}`,
        provider: "ollama" as AiProviderId,
        supportsVision: m.name.toLowerCase().includes("vision") || m.name.toLowerCase().includes("llava"),
        supportsEmbedding: m.name.toLowerCase().includes("embed"),
        description: `Local model (${m.details?.parameter_size || "local weights"}, family: ${m.details?.family || "custom"})`,
      }));
    } catch {
      return [];
    }
  }

  async generate(
    req: AiGenerateRequest,
    credentials: ProviderCredentials
  ): Promise<AiGenerateResponse> {
    const base = this.getBaseUrl(credentials);
    const start = Date.now();

    const res = await fetchWithSafeEgress(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: req.modelId,
        prompt: req.systemInstruction
          ? `[System: ${req.systemInstruction}]\n\n${req.prompt}`
          : req.prompt,
        stream: false,
        options: {
          temperature: req.temperature ?? 0.2,
          num_predict: req.maxOutputTokens ?? 2048,
        },
      }),
      signal: AbortSignal.timeout(req.timeoutMs || 30000),
    });

    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Local Ollama error (${res.status}): ${errText || res.statusText}`);
    }

    const data = await res.json();
    return {
      text: data.response?.trim() || "",
      model: req.modelId,
      provider: "ollama",
      latencyMs,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      finishReason: data.done ? "STOP" : null,
    };
  }
}
