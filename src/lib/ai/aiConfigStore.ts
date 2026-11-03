// src/lib/ai/aiConfigStore.ts
// Server-side source of truth for AI providers, models, and workload routing.
// Persists safely and encrypts credentials at rest.

import fs from "fs";
import path from "path";
import { AiSystemConfig, StoredProviderConfig, RegisteredModel, WorkloadRoutingRule, AiProviderId } from "./types";
import { encryptApiKey, decryptApiKey, maskApiKey } from "./encryption";

const CONFIG_FILE_PATH = path.join(process.cwd(), ".vos-ai-config.json");

const DEFAULT_PROVIDERS: Record<AiProviderId, StoredProviderConfig> = {
  google: {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    isActive: true,
  },
  ollama: {
    id: "ollama",
    name: "Local Ollama",
    baseUrl: "http://localhost:11434",
    isActive: false,
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    isActive: false,
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1",
    isActive: false,
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    isActive: false,
  },
  local_custom: {
    id: "local_custom",
    name: "Custom Local (vLLM / LM Studio)",
    baseUrl: "http://localhost:1234/v1",
    isActive: false,
  },
};

const DEFAULT_MODELS: RegisteredModel[] = [
  {
    id: "gemini-3.5-flash-lite",
    displayName: "Gemini 3.5 Flash Lite",
    provider: "google",
    modalities: ["text", "vision"],
    rpmLimit: 15,
    tpmLimit: 250000,
    rpdLimit: 500,
    inputPricePerMillion: 0.018,
    outputPricePerMillion: 0.072,
    isActive: true,
  },
  {
    id: "gemini-3.1-flash-lite",
    displayName: "Gemini 3.1 Flash Lite",
    provider: "google",
    modalities: ["text", "vision"],
    rpmLimit: 15,
    tpmLimit: 250000,
    rpdLimit: 500,
    inputPricePerMillion: 0.018,
    outputPricePerMillion: 0.072,
    isActive: true,
  },
  {
    id: "gemini-3.6-flash",
    displayName: "Gemini 3.6 Flash",
    provider: "google",
    modalities: ["text", "vision"],
    rpmLimit: 5,
    tpmLimit: 250000,
    rpdLimit: 20,
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    isActive: true,
  },
  {
    id: "gemma-4-26b-a4b-it",
    displayName: "Gemma 4 26B",
    provider: "google",
    modalities: ["text", "vision"],
    rpmLimit: 30,
    tpmLimit: 16000,
    rpdLimit: 14400,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    isActive: true,
  },
  {
    id: "gemini-embedding-001",
    displayName: "Gemini Embedding 1",
    provider: "google",
    modalities: ["embedding"],
    rpmLimit: 100,
    tpmLimit: 30000,
    rpdLimit: 1000,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    isActive: true,
  },
  {
    id: "llama3.2:latest",
    displayName: "Ollama Llama 3.2",
    provider: "ollama",
    modalities: ["text"],
    rpmLimit: 9999,
    tpmLimit: 999999,
    rpdLimit: 999999,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    isActive: true,
  },
];

const DEFAULT_WORKLOAD_ROUTING: Record<string, WorkloadRoutingRule> = {
  QUERY_UNDERSTANDING: {
    feature: "QUERY_UNDERSTANDING",
    primaryModelId: "gemini-3.1-flash-lite",
    fallbackModelId: "gemini-3.5-flash-lite",
    enableFailover: true,
    notes: "Interactive search parsing — requires sub-second latency",
  },
  ROLE_INTELLIGENCE: {
    feature: "ROLE_INTELLIGENCE",
    primaryModelId: "gemini-3.1-flash-lite",
    fallbackModelId: "gemini-3.5-flash-lite",
    enableFailover: true,
    notes: "Role recommendations and taxonomy extraction",
  },
  REFINE_JOB_TEXT: {
    feature: "REFINE_JOB_TEXT",
    primaryModelId: "gemini-3.1-flash-lite",
    fallbackModelId: "gemini-3.5-flash-lite",
    enableFailover: true,
    notes: "Inline job description polishing",
  },
  REFINE_COMPANY_TEXT: {
    feature: "REFINE_COMPANY_TEXT",
    primaryModelId: "gemini-3.1-flash-lite",
    fallbackModelId: "gemini-3.5-flash-lite",
    enableFailover: true,
    notes: "Inline company bio polishing",
  },
  AUTO_CREATE_JOB: {
    feature: "AUTO_CREATE_JOB",
    primaryModelId: "gemini-3.5-flash-lite",
    fallbackModelId: "gemini-3.1-flash-lite",
    enableFailover: true,
    notes: "Comprehensive job generation from brief title",
  },
  COMPANY_PROFILE_AI: {
    feature: "COMPANY_PROFILE_AI",
    primaryModelId: "gemini-3.5-flash-lite",
    fallbackModelId: "gemini-3.1-flash-lite",
    enableFailover: true,
    notes: "About Us and Mission statement generation",
  },
  MATCH_EXPLAINER: {
    feature: "MATCH_EXPLAINER",
    primaryModelId: "gemini-3.5-flash-lite",
    fallbackModelId: "gemini-3.1-flash-lite",
    enableFailover: true,
    notes: "Candidate match summary explanations",
  },
  CAMPUS_MATCH_EXPLAINER: {
    feature: "CAMPUS_MATCH_EXPLAINER",
    primaryModelId: "gemini-3.5-flash-lite",
    fallbackModelId: "gemini-3.1-flash-lite",
    enableFailover: true,
    notes: "Campus internship compatibility explanations",
  },
  BEST_MATCH: {
    feature: "BEST_MATCH",
    primaryModelId: "gemini-3.5-flash-lite",
    fallbackModelId: "gemma-4-26b-a4b-it",
    enableFailover: true,
    notes: "Top candidate scoring and ranking",
  },
  AI_RERANKER: {
    feature: "AI_RERANKER",
    primaryModelId: "gemini-3.5-flash-lite",
    fallbackModelId: "gemma-4-26b-a4b-it",
    enableFailover: true,
    notes: "High-volume candidate reranking",
  },
};

function defaultConfig(): AiSystemConfig {
  return {
    providers: DEFAULT_PROVIDERS,
    models: DEFAULT_MODELS,
    workloadRouting: DEFAULT_WORKLOAD_ROUTING,
    globalFailoverEnabled: true,
    localAiOnlyMode: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * `unreadable` means the file exists but could not be read or parsed. It is
 * deliberately not merged into "no config yet": the caller has to be able to
 * tell a half-written file (which must not be overwritten with defaults, and
 * must not be allowed to re-enable cloud egress) from a clean install.
 */
function readConfigState(): { config: AiSystemConfig; unreadable: boolean } {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      return {
        config: {
          providers: { ...DEFAULT_PROVIDERS, ...(parsed.providers || {}) },
          models: parsed.models?.length ? parsed.models : DEFAULT_MODELS,
          workloadRouting: { ...DEFAULT_WORKLOAD_ROUTING, ...(parsed.workloadRouting || {}) },
          globalFailoverEnabled: parsed.globalFailoverEnabled ?? true,
          localAiOnlyMode: parsed.localAiOnlyMode ?? false,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        },
        unreadable: false,
      };
    }
  } catch (err) {
    console.error("[ai-config-store] Error reading config file:", err);
    return { config: defaultConfig(), unreadable: true };
  }

  return { config: defaultConfig(), unreadable: false };
}

/** Save config to disk safely. `false` means nothing reached disk. */
function writeConfigToDisk(config: AiSystemConfig): boolean {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[ai-config-store] Error saving config file:", err);
    return false;
  }
}

/** Get AI system config (safe for UI when maskCredentials is true) */
export function getAiSystemConfig(maskCredentials = true): AiSystemConfig {
  const config = readConfigState().config;

  if (maskCredentials) {
    const maskedProviders = { ...config.providers };
    for (const p of Object.values(maskedProviders)) {
      p.maskedApiKey = maskApiKey(p.encryptedApiKey);
      delete p.encryptedApiKey; // Never leak encrypted hash to frontend
    }
    return { ...config, providers: maskedProviders };
  }

  return config;
}

/** Get decrypted credentials for server-side execution */
export function getDecryptedProviderCredentials(providerId: AiProviderId): { apiKey: string; baseUrl: string } {
  const config = readConfigState().config;
  const prov = config.providers[providerId];
  if (!prov) {
    return { apiKey: "", baseUrl: "" };
  }

  return {
    apiKey: prov.encryptedApiKey ? decryptApiKey(prov.encryptedApiKey) : "",
    baseUrl: prov.baseUrl,
  };
}

/**
 * Save or update provider configuration (encrypts raw API key).
 *
 * `false` means the change was not persisted — either because the file could
 * not be written, or because it could not be read and merging into defaults
 * would erase every other stored credential.
 */
export function saveProviderConfig(
  providerId: AiProviderId,
  data: {
    baseUrl?: string;
    rawApiKey?: string;
    isActive?: boolean;
    lastTestedAt?: string | null;
    lastTestStatus?: "OK" | "ERROR" | null;
    lastTestLatencyMs?: number | null;
    lastTestError?: string | null;
  }
): boolean {
  const { config, unreadable } = readConfigState();
  if (unreadable) {
    console.error(
      "[ai-config-store] Refusing to write provider config: the existing config file is unreadable and overwriting it with defaults would drop stored credentials."
    );
    return false;
  }
  const existing = config.providers[providerId] || {
    id: providerId,
    name: providerId.toUpperCase(),
    baseUrl: "",
    isActive: false,
  };

  const updated: StoredProviderConfig = {
    ...existing,
    baseUrl: data.baseUrl ?? existing.baseUrl,
    isActive: data.isActive ?? existing.isActive,
    lastTestedAt: data.lastTestedAt !== undefined ? data.lastTestedAt : existing.lastTestedAt,
    lastTestStatus: data.lastTestStatus !== undefined ? data.lastTestStatus : existing.lastTestStatus,
    lastTestLatencyMs: data.lastTestLatencyMs !== undefined ? data.lastTestLatencyMs : existing.lastTestLatencyMs,
    lastTestError: data.lastTestError !== undefined ? data.lastTestError : existing.lastTestError,
  };

  if (data.rawApiKey !== undefined) {
    updated.encryptedApiKey = data.rawApiKey ? encryptApiKey(data.rawApiKey) : "";
  }

  config.providers[providerId] = updated;
  config.updatedAt = new Date().toISOString();
  return writeConfigToDisk(config);
}

/**
 * Register a new model or update an existing one.
 * `false` means the registry was not persisted. See {@link saveProviderConfig}.
 */
export function registerOrUpdateModel(model: RegisteredModel): boolean {
  const { config, unreadable } = readConfigState();
  if (unreadable) {
    console.error(
      "[ai-config-store] Refusing to write model registry: the existing config file is unreadable."
    );
    return false;
  }
  const idx = config.models.findIndex((m) => m.id === model.id);
  if (idx >= 0) {
    config.models[idx] = model;
  } else {
    config.models.push(model);
  }
  config.updatedAt = new Date().toISOString();
  return writeConfigToDisk(config);
}

/**
 * Save workload assignments and failover settings.
 * `false` means the settings — including `localAiOnlyMode` — were not persisted.
 */
export function saveWorkloadRouting(
  routing: Record<string, WorkloadRoutingRule>,
  settings?: { globalFailoverEnabled?: boolean; localAiOnlyMode?: boolean }
): boolean {
  const { config, unreadable } = readConfigState();
  if (unreadable) {
    console.error(
      "[ai-config-store] Refusing to write workload routing: the existing config file is unreadable."
    );
    return false;
  }
  config.workloadRouting = { ...config.workloadRouting, ...routing };
  if (settings?.globalFailoverEnabled !== undefined) {
    config.globalFailoverEnabled = settings.globalFailoverEnabled;
  }
  if (settings?.localAiOnlyMode !== undefined) {
    config.localAiOnlyMode = settings.localAiOnlyMode;
  }
  config.updatedAt = new Date().toISOString();
  return writeConfigToDisk(config);
}

/**
 * Admin toggle: when true, no prompt may leave the server for a cloud provider.
 *
 * An unreadable config file reports the restriction as *on*: this is the only
 * gate keeping candidate PII off a cloud processor, so its failure mode cannot
 * be the permissive default.
 */
export function isLocalAiOnlyMode(): boolean {
  const { config, unreadable } = readConfigState();
  return unreadable || config.localAiOnlyMode === true;
}

/** Resolve assigned model for an application feature */
export function resolveWorkloadModel(feature: string): {
  primaryModel: RegisteredModel;
  fallbackModel: RegisteredModel | null;
  enableFailover: boolean;
} {
  const config = readConfigState().config;
  const rule = config.workloadRouting[feature];

  const fallbackDefault = config.models.find((m) => m.id === "gemini-3.5-flash-lite") || config.models[0];

  const primaryModel =
    config.models.find((m) => m.id === rule?.primaryModelId && m.isActive) ||
    fallbackDefault;

  const fallbackModel = rule?.fallbackModelId
    ? config.models.find((m) => m.id === rule.fallbackModelId && m.isActive) || null
    : null;

  return {
    primaryModel,
    fallbackModel,
    enableFailover: rule?.enableFailover ?? config.globalFailoverEnabled,
  };
}
