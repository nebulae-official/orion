"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { saveProviderConfig } from "@/lib/actions";
import { apiClient } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";
import {
  Check,
  CheckCircle,
  Loader2,
  AlertCircle,
  RotateCcw,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ApiError } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderOption {
  value: string;
  label: string;
}

interface ModelOption {
  value: string;
  label: string;
  provider: string;
}

interface ModelParams {
  temperature?: number;
  maxTokens?: number;
  width?: number;
  height?: number;
  quality?: "standard" | "hd";
}

interface ServiceConfig {
  service: string;
  label: string;
  provider: string;
  model: string;
  status: "connected" | "disconnected" | "checking";
  errorMessage?: string;
  params: ModelParams;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_OPTIONS: ProviderOption[] = [
  { value: "LOCAL", label: "Local (Ollama / ComfyUI)" },
  { value: "CLOUD", label: "Cloud (OpenAI / Replicate)" },
];

const MODEL_OPTIONS: Record<string, ModelOption[]> = {
  llm: [
    { value: "llama3.2", label: "Llama 3.2", provider: "LOCAL" },
    { value: "mistral", label: "Mistral 7B", provider: "LOCAL" },
    { value: "gpt-4o", label: "GPT-4o", provider: "CLOUD" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "CLOUD" },
  ],
  image: [
    { value: "sdxl", label: "Stable Diffusion XL", provider: "LOCAL" },
    { value: "flux", label: "Flux", provider: "LOCAL" },
    { value: "dall-e-3", label: "DALL-E 3", provider: "CLOUD" },
  ],
  video: [
    { value: "animatediff", label: "AnimateDiff", provider: "LOCAL" },
    { value: "svd", label: "Stable Video Diffusion", provider: "LOCAL" },
    { value: "runway-gen3", label: "Runway Gen-3", provider: "CLOUD" },
  ],
  tts: [
    { value: "piper", label: "Piper TTS", provider: "LOCAL" },
    { value: "coqui", label: "Coqui TTS", provider: "LOCAL" },
    { value: "elevenlabs", label: "ElevenLabs", provider: "CLOUD" },
    { value: "openai-tts", label: "OpenAI TTS", provider: "CLOUD" },
  ],
};

const DEFAULT_PARAMS: Record<string, ModelParams> = {
  llm: { temperature: 0.7, maxTokens: 4096 },
  image: { width: 1920, height: 1080, quality: "standard" },
  video: { width: 1920, height: 1080 },
  tts: {},
};

const DEFAULT_CONFIGS: ServiceConfig[] = [
  { service: "llm", label: "LLM (Text Generation)", provider: "LOCAL", model: "llama3.2", status: "checking", params: { ...DEFAULT_PARAMS.llm } },
  { service: "image", label: "Image Generation", provider: "LOCAL", model: "sdxl", status: "checking", params: { ...DEFAULT_PARAMS.image } },
  { service: "video", label: "Video Generation", provider: "LOCAL", model: "animatediff", status: "checking", params: { ...DEFAULT_PARAMS.video } },
  { service: "tts", label: "Text-to-Speech", provider: "LOCAL", model: "piper", status: "checking", params: { ...DEFAULT_PARAMS.tts } },
];

// ---------------------------------------------------------------------------
// StatusDot
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: ServiceConfig["status"] }): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        status === "connected" && "bg-success",
        status === "disconnected" && "bg-danger",
        status === "checking" && "animate-pulse bg-warning"
      )}
      title={status}
    />
  );
}

// ---------------------------------------------------------------------------
// ProviderConfig
// ---------------------------------------------------------------------------

export function ProviderConfig(): React.ReactElement {
  const [configs, setConfigs] = useState<ServiceConfig[]>(DEFAULT_CONFIGS);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [expandedParams, setExpandedParams] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const checkStatus = useCallback(async (service: string): Promise<{ status: "connected" | "disconnected"; error?: string }> => {
    if (DEMO_MODE) {
      return { status: "connected" };
    }
    try {
      await apiClient.get(`/api/v1/providers/${service}/status`);
      return { status: "connected" };
    } catch (err: unknown) {
      let errorMessage = "Connection failed";
      if (err instanceof ApiError) {
        if (err.status === 404) {
          errorMessage = "Model not found";
        } else if (err.status === 401 || err.status === 403) {
          errorMessage = "Authentication failed";
        } else if (err.status === 408) {
          errorMessage = "Connection timed out";
        } else if (err.status === 503) {
          errorMessage = "Service unavailable";
        } else {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        if (err.message.includes("fetch") || err.message.includes("ECONNREFUSED")) {
          errorMessage = "Service not running";
        } else if (err.message.includes("timeout") || err.message.includes("ETIMEDOUT")) {
          errorMessage = "Connection timed out";
        } else {
          errorMessage = err.message;
        }
      }
      return { status: "disconnected", error: errorMessage };
    }
  }, []);

  useEffect(() => {
    async function loadStatuses(): Promise<void> {
      const updated = await Promise.all(
        configs.map(async (c) => {
          const result = await checkStatus(c.service);
          return { ...c, status: result.status, errorMessage: result.error };
        })
      );
      setConfigs(updated);
    }
    loadStatuses();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleProviderChange(service: string, provider: string): void {
    setConfigs((prev) =>
      prev.map((c) => {
        if (c.service !== service) return c;
        const models = MODEL_OPTIONS[service]?.filter((m) => m.provider === provider) ?? [];
        return { ...c, provider, model: models[0]?.value ?? "" };
      })
    );
  }

  function handleModelChange(service: string, model: string): void {
    setConfigs((prev) =>
      prev.map((c) => (c.service === service ? { ...c, model } : c))
    );
  }

  function handleParamChange(service: string, key: keyof ModelParams, value: number | string): void {
    setConfigs((prev) =>
      prev.map((c) =>
        c.service === service
          ? { ...c, params: { ...c.params, [key]: value } }
          : c
      )
    );
  }

  async function handleSave(service: string): Promise<void> {
    const config = configs.find((c) => c.service === service);
    if (!config) return;

    setSaving(service);
    setMessage(null);

    const result = await saveProviderConfig(service, config.provider, config.model);

    if (result.success) {
      setMessage({ type: "success", text: `${config.label} configuration saved.` });
      const { status, error } = await checkStatus(service);
      setConfigs((prev) =>
        prev.map((c) => (c.service === service ? { ...c, status, errorMessage: error } : c))
      );
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to save configuration." });
    }

    setSaving(null);
  }

  async function handleTestConnection(service: string): Promise<void> {
    const config = configs.find((c) => c.service === service);
    if (!config) return;

    setTesting(service);
    setMessage(null);

    if (DEMO_MODE) {
      // Simulate a connection test
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setConfigs((prev) =>
        prev.map((c) => (c.service === service ? { ...c, status: "connected", errorMessage: undefined } : c))
      );
      setMessage({ type: "success", text: `${config.label} connection successful.` });
      setTesting(null);
      return;
    }

    const { status, error } = await checkStatus(service);
    setConfigs((prev) =>
      prev.map((c) => (c.service === service ? { ...c, status, errorMessage: error } : c))
    );
    if (status === "connected") {
      setMessage({ type: "success", text: `${config.label} connection successful.` });
    } else {
      setMessage({ type: "error", text: `${config.label} connection failed: ${error ?? "Unknown error"}.` });
    }
    setTesting(null);
  }

  function handleResetAll(): void {
    setConfigs(DEFAULT_CONFIGS.map((c) => ({ ...c, status: "checking" })));
    setMessage({ type: "success", text: "All provider configurations reset to defaults." });
    // Re-check statuses
    Promise.all(
      DEFAULT_CONFIGS.map(async (c) => {
        const result = await checkStatus(c.service);
        return { ...c, status: result.status, errorMessage: result.error };
      })
    ).then(setConfigs);
  }

  function toggleParams(service: string): void {
    setExpandedParams((prev) => ({ ...prev, [service]: !prev[service] }));
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-success/30 bg-success-surface text-success-light"
              : "border-danger/30 bg-danger-surface text-danger-light"
          )}
        >
          {message.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {configs.map((config) => {
          const availableModels =
            MODEL_OPTIONS[config.service]?.filter((m) => m.provider === config.provider) ?? [];
          const isParamsExpanded = expandedParams[config.service] ?? false;
          const hasParams = config.service === "llm" || config.service === "image" || config.service === "video";

          return (
            <div
              key={config.service}
              className="rounded-xl border border-border bg-surface p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text">
                  {config.label}
                </h3>
                <StatusDot status={config.status} />
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor={`provider-${config.service}`}
                    className="mb-1 block text-sm font-medium text-text-secondary"
                  >
                    Provider
                  </label>
                  <select
                    id={`provider-${config.service}`}
                    value={config.provider}
                    onChange={(e) => handleProviderChange(config.service, e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`model-${config.service}`}
                    className="mb-1 block text-sm font-medium text-text-secondary"
                  >
                    Model
                  </label>
                  <select
                    id={`model-${config.service}`}
                    value={config.model}
                    onChange={(e) => handleModelChange(config.service, e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {availableModels.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model Parameters (collapsible) */}
                {hasParams && (
                  <div>
                    <button
                      onClick={() => toggleParams(config.service)}
                      className="flex w-full items-center justify-between rounded-lg bg-surface-elevated px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text"
                    >
                      <span>Model Parameters</span>
                      {isParamsExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {isParamsExpanded && (
                      <div className="mt-2 space-y-3 rounded-lg border border-border bg-surface-elevated p-3">
                        {config.service === "llm" && (
                          <>
                            <div>
                              <div className="mb-1 flex items-center justify-between">
                                <label className="text-xs font-medium text-text-muted">Temperature</label>
                                <span className="font-mono text-xs text-text-muted">
                                  {(config.params.temperature ?? 0.7).toFixed(2)}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={2}
                                step={0.05}
                                value={config.params.temperature ?? 0.7}
                                onChange={(e) =>
                                  handleParamChange(config.service, "temperature", parseFloat(e.target.value))
                                }
                                className="w-full accent-primary"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-text-muted">
                                Max Tokens
                              </label>
                              <input
                                type="number"
                                min={256}
                                max={128000}
                                step={256}
                                value={config.params.maxTokens ?? 4096}
                                onChange={(e) =>
                                  handleParamChange(config.service, "maxTokens", parseInt(e.target.value, 10))
                                }
                                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          </>
                        )}
                        {(config.service === "image" || config.service === "video") && (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-text-muted">Width</label>
                                <input
                                  type="number"
                                  min={256}
                                  max={4096}
                                  step={64}
                                  value={config.params.width ?? 1920}
                                  onChange={(e) =>
                                    handleParamChange(config.service, "width", parseInt(e.target.value, 10))
                                  }
                                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-text-muted">Height</label>
                                <input
                                  type="number"
                                  min={256}
                                  max={4096}
                                  step={64}
                                  value={config.params.height ?? 1080}
                                  onChange={(e) =>
                                    handleParamChange(config.service, "height", parseInt(e.target.value, 10))
                                  }
                                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                            </div>
                            {config.service === "image" && (
                              <div>
                                <label className="mb-1 block text-xs font-medium text-text-muted">Quality</label>
                                <select
                                  value={config.params.quality ?? "standard"}
                                  onChange={(e) =>
                                    handleParamChange(config.service, "quality", e.target.value)
                                  }
                                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                  <option value="standard">Standard</option>
                                  <option value="hd">HD</option>
                                </select>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(config.service)}
                    disabled={saving === config.service}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
                      saving === config.service
                        ? "cursor-not-allowed bg-primary-muted"
                        : "bg-primary hover:bg-primary-muted"
                    )}
                  >
                    {saving === config.service ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </button>
                  <button
                    onClick={() => handleTestConnection(config.service)}
                    disabled={testing === config.service}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      testing === config.service
                        ? "cursor-not-allowed border-border text-text-dim"
                        : "border-border text-text-secondary hover:bg-surface-elevated hover:text-text"
                    )}
                  >
                    {testing === config.service ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : config.status === "connected" ? (
                      <Wifi className="h-4 w-4" />
                    ) : (
                      <WifiOff className="h-4 w-4" />
                    )}
                    Test
                  </button>
                </div>

                {/* Connection status message */}
                {config.status === "connected" && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-success">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Connected</span>
                  </div>
                )}
                {config.status === "disconnected" && config.errorMessage && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-danger-surface/50 px-3 py-2 text-xs text-danger-light">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{config.errorMessage}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset to Defaults */}
      <div className="flex justify-end">
        <button
          onClick={handleResetAll}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
