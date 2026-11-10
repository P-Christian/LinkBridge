"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { motion, type Variants } from "framer-motion";
import { toast } from "sonner";
import {
  AiSystemConfig,
  AiProviderId,
  StoredProviderConfig,
  RegisteredModel,
  DiscoveredModel,
  ProviderTestResult,
} from "@/lib/ai/types";

// ── Motion Physics Variants ──────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

const cardHoverVariants: Variants = {
  initial: { y: 0, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.25 } },
  hover: {
    y: -3,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  tap: {
    scale: 0.985,
    transition: { duration: 0.1 },
  },
};

const TABS = [
  { id: "workloads", label: "Workload Routing" },
  { id: "providers", label: "Providers & Credentials" },
  { id: "models", label: "Model Registry" },
  { id: "local", label: "Local AI Hub" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface WorkloadCategory {
  id: string;
  title: string;
  description: string;
  features: string[];
}

const WORKLOAD_CATEGORIES: WorkloadCategory[] = [
  {
    id: "interactive",
    title: "Interactive UI & Real-Time Parsing",
    description: "Low-latency sub-second parsing for search queries, tag generation, and inline refinement.",
    features: ["QUERY_UNDERSTANDING", "ROLE_INTELLIGENCE", "REFINE_JOB_TEXT", "REFINE_COMPANY_TEXT"],
  },
  {
    id: "generative",
    title: "Generative Content Creation",
    description: "Deep structured text synthesis for job drafts and organization bios.",
    features: ["AUTO_CREATE_JOB", "COMPANY_PROFILE_AI"],
  },
  {
    id: "intelligence",
    title: "Matching & Scoring Intelligence",
    description: "Complex candidate evaluation, match summaries, and applicant ranking.",
    features: ["MATCH_EXPLAINER", "CAMPUS_MATCH_EXPLAINER", "BEST_MATCH", "AI_RERANKER"],
  },
];

export function AiModelConfigModule() {
  const [config, setConfig] = useState<AiSystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("workloads");
  const [modelSearchQuery, setModelSearchQuery] = useState("");

  // Provider Credential Edit Dialog
  const [selectedProvider, setSelectedProvider] = useState<StoredProviderConfig | null>(null);
  const [editApiKey, setEditApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [testingProvider, setTestingProvider] = useState(false);
  const [providerTestResult, setProviderTestResult] = useState<ProviderTestResult | null>(null);

  // Model Discovery Dialog
  const [discovering, setDiscovering] = useState(false);
  const abortDiscovery = useRequestAbort();
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);
  const [showDiscoveryDialog, setShowDiscoveryDialog] = useState(false);

  // Add Custom Model Dialog
  const [showAddModelDialog, setShowAddModelDialog] = useState(false);
  const [newModel, setNewModel] = useState<Partial<RegisteredModel>>({
    id: "",
    displayName: "",
    provider: "google",
    modalities: ["text"],
    rpmLimit: 15,
    tpmLimit: 250000,
    rpdLimit: 500,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    isActive: true,
  });

  // Fetch configuration
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vos-admin/ai-config");
      if (!res.ok) throw new Error("Failed to load configuration");
      const data: AiSystemConfig = await res.json();
      setConfig(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error loading AI config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchConfig();
    });
  }, [fetchConfig]);

  // Open provider edit modal
  const handleEditProvider = useCallback((provider: StoredProviderConfig) => {
    setSelectedProvider(provider);
    setEditApiKey("");
    setShowApiKey(false);
    setEditBaseUrl(provider.baseUrl || "");
    setEditIsActive(provider.isActive);
    setProviderTestResult(null);
  }, []);

  // Save provider credentials
  const handleSaveProvider = useCallback(async () => {
    if (!selectedProvider) return;
    setSaving(true);
    try {
      const res = await fetch("/api/vos-admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_provider",
          providerId: selectedProvider.id,
          baseUrl: editBaseUrl,
          apiKey: editApiKey || undefined,
          isActive: editIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setConfig(data.config);
      setSelectedProvider(null);
      toast.success(`${selectedProvider.name} configuration updated successfully.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save provider");
    } finally {
      setSaving(false);
    }
  }, [selectedProvider, editBaseUrl, editApiKey, editIsActive]);

  // Test provider connection
  const handleTestProvider = useCallback(
    async (providerId: AiProviderId, tempKey?: string, tempUrl?: string) => {
      setTestingProvider(true);
      setProviderTestResult(null);
      try {
        const res = await fetch("/api/vos-admin/ai-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "test_provider",
            providerId,
            tempApiKey: tempKey || undefined,
            tempBaseUrl: tempUrl || undefined,
          }),
        });
        const result: ProviderTestResult = await res.json();
        setProviderTestResult(result);
        if (result.ok) {
          fetchConfig();
        }
      } catch (err) {
        setProviderTestResult({
          ok: false,
          status: 0,
          latencyMs: 0,
          modelUsed: "default",
          message: err instanceof Error ? err.message : "Test request failed",
          error: String(err),
        });
      } finally {
        setTestingProvider(false);
      }
    },
    [fetchConfig]
  );

  // Discover models from provider
  const handleDiscoverModels = useCallback(async (providerId: AiProviderId) => {
    setDiscovering(true);
    setDiscoveredModels([]);
    // Catalog discovery is slow, and the dialog it opens is shared: only the
    // newest provider's list may be shown, or B's dialog fills with A's models.
    const signal = abortDiscovery();
    try {
      const res = await fetch("/api/vos-admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          action: "discover_models",
          providerId,
        }),
      });
      const data = await res.json();
      if (signal.aborted) return;
      if (data.models) {
        setDiscoveredModels(data.models);
        setShowDiscoveryDialog(true);
      }
    } catch (err) {
      if (signal.aborted) return;
      toast.error(`Catalog discovery error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (!signal.aborted) setDiscovering(false);
    }
  }, [abortDiscovery]);

  // Register model
  const handleRegisterModel = useCallback(
    async (modelToRegister: RegisteredModel) => {
      setSaving(true);
      try {
        const res = await fetch("/api/vos-admin/ai-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "register_model",
            model: modelToRegister,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to register model");
        setConfig(data.config);
        setShowAddModelDialog(false);
        toast.success(`${modelToRegister.displayName} successfully registered.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error registering model");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  // Update Workload Routing
  const handleUpdateRouting = useCallback(
    (feature: string, field: "primaryModelId" | "fallbackModelId" | "enableFailover", value: unknown) => {
      if (!config) return;
      const updatedRouting = { ...config.workloadRouting };
      const currentRule = updatedRouting[feature] || {
        feature,
        primaryModelId: "gemini-3.5-flash-lite",
        fallbackModelId: null,
        enableFailover: true,
      };

      updatedRouting[feature] = {
        ...currentRule,
        [field]: value,
      };

      setConfig({
        ...config,
        workloadRouting: updatedRouting,
      });
    },
    [config]
  );

  // Save workload routing changes
  const handleSaveRoutingChanges = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/vos-admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_routing",
          workloadRouting: config.workloadRouting,
          globalFailoverEnabled: config.globalFailoverEnabled,
          localAiOnlyMode: config.localAiOnlyMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setConfig(data.config);
      toast.success("Workload assignments and failover settings saved successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [config]);

  // Memoized provider list
  const providerList = useMemo(() => {
    if (!config) return [];
    return Object.values(config.providers);
  }, [config]);

  // Memoized active models
  const activeModels = useMemo(() => {
    if (!config) return [];
    return config.models.filter((m) => m.isActive);
  }, [config]);

  // Filtered models for registry tab
  const filteredModels = useMemo(() => {
    if (!config) return [];
    if (!modelSearchQuery.trim()) return config.models;
    const q = modelSearchQuery.toLowerCase().trim();
    return config.models.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q)
    );
  }, [config, modelSearchQuery]);

  // Summary Metrics
  const activeProvidersCount = useMemo(() => {
    return providerList.filter((p) => p.isActive).length;
  }, [providerList]);

  const activeModelsCount = useMemo(() => {
    return activeModels.length;
  }, [activeModels]);

  const workloadCount = useMemo(() => {
    return config ? Object.keys(config.workloadRouting).length : 0;
  }, [config]);

  if (loading && !config) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground font-medium tracking-wide">Loading AI System Configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                AI & Model System Manager
              </h1>
              <Badge variant="outline" className="font-mono text-[11px] font-semibold tracking-wide">
                Active System
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Provider configuration, encrypted credential management, workload routing, and rate-limit failover automation.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchConfig}
              disabled={loading}
              className="h-8 text-xs font-medium"
            >
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleSaveRoutingChanges}
              disabled={saving}
              className="h-8 text-xs font-semibold"
            >
              Save Configuration
            </Button>
          </div>
        </div>
      </div>


      {/* ── KPI Overview Strip (Interactive Motion) ────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-4 gap-3.5"
      >
        <motion.div variants={cardHoverVariants} whileHover="hover" whileTap="tap">
          <Card className="shadow-none border bg-card transition-colors">
            <CardContent className="p-4 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Active Providers
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {activeProvidersCount}
                </span>
                <span className="text-xs text-muted-foreground font-mono">/ {providerList.length} total</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardHoverVariants} whileHover="hover" whileTap="tap">
          <Card className="shadow-none border bg-card transition-colors">
            <CardContent className="p-4 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Registered Models
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {activeModelsCount}
                </span>
                <span className="text-xs text-muted-foreground font-mono">operational</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardHoverVariants} whileHover="hover" whileTap="tap">
          <Card className="shadow-none border bg-card transition-colors">
            <CardContent className="p-4 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Mapped Features
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {workloadCount}
                </span>
                <span className="text-xs text-muted-foreground font-mono">workloads</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardHoverVariants} whileHover="hover" whileTap="tap">
          <Card className="shadow-none border bg-card transition-colors">
            <CardContent className="p-4 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Rate-Limit Failover
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-sm font-semibold text-foreground">
                  {config?.globalFailoverEnabled ? "Active & Armed" : "Disabled"}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Global Toggles Bar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="rounded-xl border bg-card p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">Automatic 429 Rate-Limit Failover</p>
            <p className="text-[11px] text-muted-foreground">
              Switches to designated backup model or Local AI when a provider returns HTTP 429.
            </p>
          </div>
          <Switch
            checked={config?.globalFailoverEnabled ?? true}
            onCheckedChange={(checked) =>
              setConfig((prev) => (prev ? { ...prev, globalFailoverEnabled: checked } : prev))
            }
          />
        </div>

        <div className="rounded-xl border bg-card p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">Offline / Local AI Only Mode</p>
            <p className="text-[11px] text-muted-foreground">
              Routes all workloads exclusively through Local Ollama with zero external API calls.
            </p>
          </div>
          <Switch
            checked={config?.localAiOnlyMode ?? false}
            onCheckedChange={(checked) =>
              setConfig((prev) => (prev ? { ...prev, localAiOnlyMode: checked } : prev))
            }
          />
        </div>
      </div>

      {/* ── Segmented Navigation Tabs ──────────────────────────────────────── */}
      <div className="border-b border-border">
        <div className="flex items-center gap-6">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 text-xs font-semibold transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="tabPill"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab 1: Workload Routing ────────────────────────────────────────── */}
      {activeTab === "workloads" && (
        <motion.div
          key="workloads"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {WORKLOAD_CATEGORIES.map((category) => (
            <Card key={category.id} className="shadow-none border">
              <CardHeader className="py-4 px-5 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                  {category.title}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {category.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/10 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <th className="py-3 px-5">Feature</th>
                        <th className="py-3 px-4">Primary Model</th>
                        <th className="py-3 px-4">Fallback Backup Model</th>
                        <th className="py-3 px-4 text-center">Failover</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {category.features.map((featureKey) => {
                        const rule = config?.workloadRouting[featureKey] || {
                          feature: featureKey,
                          primaryModelId: "gemini-3.5-flash-lite",
                          fallbackModelId: null,
                          enableFailover: true,
                        };

                        return (
                          <tr key={featureKey} className="hover:bg-muted/10 transition-colors">
                            <td className="py-3 px-5">
                              <span className="font-semibold text-foreground font-mono">{featureKey}</span>
                            </td>
                            <td className="py-3 px-4">
                              <SearchableSelect
                                value={rule.primaryModelId}
                                onValueChange={(val) => handleUpdateRouting(featureKey, "primaryModelId", val)}
                                options={activeModels.map((m) => ({
                                  value: m.id,
                                  label: m.displayName,
                                }))}
                                placeholder="Select model"
                                triggerClassName="w-56 h-8 text-xs"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <SearchableSelect
                                value={rule.fallbackModelId || "none"}
                                onValueChange={(val) =>
                                  handleUpdateRouting(
                                    featureKey,
                                    "fallbackModelId",
                                    val === "none" ? null : val
                                  )
                                }
                                options={[
                                  { value: "none", label: "None" },
                                  ...activeModels.map((m) => ({
                                    value: m.id,
                                    label: m.displayName,
                                  })),
                                ]}
                                placeholder="None"
                                triggerClassName="w-56 h-8 text-xs"
                              />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Switch
                                checked={rule.enableFailover}
                                onCheckedChange={(checked) =>
                                  handleUpdateRouting(featureKey, "enableFailover", checked)
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* ── Tab 2: Providers & Credentials ─────────────────────────────────── */}
      {activeTab === "providers" && (
        <motion.div
          key="providers"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {providerList.map((p) => {
            const isOk = p.lastTestStatus === "OK";
            const isError = p.lastTestStatus === "ERROR";

            return (
              <motion.div
                key={p.id}
                variants={cardHoverVariants}
                whileHover="hover"
                className="flex flex-col justify-between rounded-xl border bg-card p-4 space-y-4 shadow-none"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{p.name}</span>
                    <Badge variant={p.isActive ? "default" : "outline"} className="text-[10px] font-mono">
                      {p.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">
                    {p.baseUrl || "Default cloud endpoint"}
                  </p>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground font-sans">API Key:</span>
                    <span className="font-semibold">
                      {p.maskedApiKey || (p.id === "ollama" ? "Not Required" : "Unset")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground font-sans">Status:</span>
                    {isOk && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected ({p.lastTestLatencyMs}ms)
                      </span>
                    )}
                    {isError && (
                      <span className="text-destructive font-semibold">Failed</span>
                    )}
                    {!isOk && !isError && (
                      <span className="text-muted-foreground">Untested</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8 font-medium"
                    onClick={() => handleTestProvider(p.id)}
                    disabled={testingProvider}
                  >
                    Ping Test
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8 font-medium"
                    onClick={() => handleDiscoverModels(p.id)}
                    disabled={discovering}
                  >
                    Catalog
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs h-8 font-medium px-3"
                    onClick={() => handleEditProvider(p)}
                  >
                    Edit
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ── Tab 3: Model Registry ─────────────────────────────────────────── */}
      {activeTab === "models" && (
        <motion.div
          key="models"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Input
              placeholder="Filter models by name, ID, or provider..."
              value={modelSearchQuery}
              onChange={(e) => setModelSearchQuery(e.target.value)}
              className="max-w-xs h-8 text-xs font-mono"
            />
            <Button
              size="sm"
              onClick={() => setShowAddModelDialog(true)}
              className="h-8 text-xs font-medium"
            >
              Add Custom Model
            </Button>
          </div>

          <Card className="shadow-none border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/10 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-3 px-4">Display Name</th>
                      <th className="py-3 px-4">Model ID</th>
                      <th className="py-3 px-4">Provider</th>
                      <th className="py-3 px-4">Modalities</th>
                      <th className="py-3 px-4">Rate Limits</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredModels.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4 font-semibold text-foreground">{m.displayName}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">{m.id}</td>
                        <td className="py-3 px-4 font-mono capitalize">{m.provider}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {m.modalities.map((mod) => (
                              <Badge key={mod} variant="outline" className="text-[10px] font-mono uppercase">
                                {mod}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {m.rpmLimit >= 9999 ? "Unlimited" : `${m.rpmLimit} RPM | ${m.rpdLimit} RPD`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={m.isActive ? "default" : "outline"} className="text-[10px]">
                            {m.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Tab 4: Local AI Hub ────────────────────────────────────────────── */}
      {activeTab === "local" && (
        <motion.div
          key="local"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <Card className="shadow-none border">
            <CardHeader className="py-4 px-5 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                    Local AI Server
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Zero-cost and rate-limit free inference via Ollama or custom local server runtime.
                  </CardDescription>
                </div>
                <Badge variant={config?.providers.ollama.isActive ? "default" : "outline"} className="text-[10px] font-mono">
                  {config?.providers.ollama.isActive ? "Enabled" : "Standby"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5 max-w-md">
                <label className="text-xs font-semibold text-foreground">Server Base URL</label>
                <Input
                  value={config?.providers.ollama.baseUrl || "http://localhost:11434"}
                  readOnly
                  className="font-mono text-xs bg-muted/30 h-8"
                />
                <p className="text-[11px] text-muted-foreground">
                  Executed by the Node.js server runtime (default Ollama port: 11434).
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 font-medium"
                  onClick={() => handleTestProvider("ollama")}
                  disabled={testingProvider}
                >
                  Test Server Reachability
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 font-medium"
                  onClick={() => handleDiscoverModels("ollama")}
                  disabled={discovering}
                >
                  Scan Installed Local Models
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Dialog: Edit Provider Credentials ──────────────────────────────── */}
      <Dialog open={!!selectedProvider} onOpenChange={(open) => !open && setSelectedProvider(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Configure {selectedProvider?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Credentials are encrypted at rest with AES-256-GCM. Raw keys are never transmitted to the browser.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Base Endpoint URL</label>
              <Input
                value={editBaseUrl}
                onChange={(e) => setEditBaseUrl(e.target.value)}
                placeholder="https://..."
                className="font-mono text-xs h-8"
              />
            </div>

            {selectedProvider?.id !== "ollama" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">API Key</label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {selectedProvider?.maskedApiKey ? `Current: ${selectedProvider.maskedApiKey}` : "Unset"}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={editApiKey}
                    onChange={(e) => setEditApiKey(e.target.value)}
                    placeholder={selectedProvider?.maskedApiKey ? "Leave empty to keep existing key" : "Enter API key"}
                    className="font-mono text-xs pr-16 h-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground hover:text-foreground px-1 py-0.5"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-foreground">Enable Provider</span>
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
            </div>

            {providerTestResult && (
              <div
                className={`p-3 rounded-lg text-xs font-medium border ${
                  providerTestResult.ok
                    ? "bg-primary/5 border-primary/20 text-primary"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}
              >
                {providerTestResult.message}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                selectedProvider && handleTestProvider(selectedProvider.id, editApiKey || undefined, editBaseUrl)
              }
              disabled={testingProvider}
              className="text-xs h-8 font-medium"
            >
              Test Connection
            </Button>
            <Button
              size="sm"
              onClick={handleSaveProvider}
              disabled={saving}
              className="text-xs h-8 font-semibold"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Discovered Models Catalog ──────────────────────────────── */}
      <Dialog open={showDiscoveryDialog} onOpenChange={setShowDiscoveryDialog}>
        <DialogContent className="sm:max-w-lg max-h-[75vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Catalog Models</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Discovered from provider catalog. Register models to add them to your active registry.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto space-y-2 py-2 flex-1">
            {discoveredModels.map((dm) => {
              const isAlreadyRegistered = config?.models.some((m) => m.id === dm.id);

              return (
                <div
                  key={dm.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card text-xs hover:bg-muted/10 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground">{dm.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{dm.id}</p>
                  </div>

                  {isAlreadyRegistered ? (
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      Registered
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() =>
                        handleRegisterModel({
                          id: dm.id,
                          displayName: dm.name,
                          provider: dm.provider,
                          modalities: dm.supportsVision ? ["text", "vision"] : ["text"],
                          rpmLimit: 15,
                          tpmLimit: 250000,
                          rpdLimit: 500,
                          inputPricePerMillion: 0,
                          outputPricePerMillion: 0,
                          isActive: true,
                        })
                      }
                    >
                      Register
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Add Custom Model ───────────────────────────────────────── */}
      <Dialog open={showAddModelDialog} onOpenChange={setShowAddModelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Register Custom Model</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a newly released cloud model ID or locally downloaded Ollama model tag.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Model ID</label>
              <Input
                placeholder="e.g. gemini-3.5-flash-lite, llama3.2:3b"
                value={newModel.id}
                onChange={(e) => setNewModel({ ...newModel, id: e.target.value })}
                className="font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Display Name</label>
              <Input
                placeholder="e.g. Gemini 3.5 Flash Lite"
                value={newModel.displayName}
                onChange={(e) => setNewModel({ ...newModel, displayName: e.target.value })}
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Provider</label>
              <SearchableSelect
                value={newModel.provider}
                onValueChange={(val) => setNewModel({ ...newModel, provider: val as AiProviderId })}
                options={[
                  { value: "google", label: "Google Gemini" },
                  { value: "ollama", label: "Local Ollama" },
                  { value: "openai", label: "OpenAI" },
                  { value: "anthropic", label: "Anthropic Claude" },
                  { value: "mistral", label: "Mistral AI" },
                ]}
                placeholder="Select provider"
                triggerClassName="text-xs h-8 w-full"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">RPM Limit</label>
                <Input
                  type="number"
                  value={newModel.rpmLimit}
                  onChange={(e) => setNewModel({ ...newModel, rpmLimit: Number(e.target.value) })}
                  className="font-mono text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">RPD Limit</label>
                <Input
                  type="number"
                  value={newModel.rpdLimit}
                  onChange={(e) => setNewModel({ ...newModel, rpdLimit: Number(e.target.value) })}
                  className="font-mono text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">TPM Limit</label>
                <Input
                  type="number"
                  value={newModel.tpmLimit}
                  onChange={(e) => setNewModel({ ...newModel, tpmLimit: Number(e.target.value) })}
                  className="font-mono text-xs h-8"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              disabled={!newModel.id || !newModel.displayName || saving}
              onClick={() => handleRegisterModel(newModel as RegisteredModel)}
              className="text-xs h-8 font-semibold"
            >
              Register Model
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
