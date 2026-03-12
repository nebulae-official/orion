"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { saveProviderConfig } from "@/lib/actions";
import { apiClient } from "@/lib/api-client";
import { Check, Loader2, AlertCircle } from "lucide-react";

interface ProviderOption {
  value: string;
  label: string;
}

interface ModelOption {
  value: string;
  label: string;
  provider: string;
}

interface ServiceConfig {
  service: string;
  label: string;
  provider: string;
  model: string;
  status: "connected" | "disconnected" | "checking";
}

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

const DEFAULT_CONFIGS: ServiceConfig[] = [
  { service: "llm", label: "LLM (Text Generation)", provider: "LOCAL", model: "llama3.2", status: "checking" },
  { service: "image", label: "Image Generation", provider: "LOCAL", model: "sdxl", status: "checking" },
  { service: "video", label: "Video Generation", provider: "LOCAL", model: "animatediff", status: "checking" },
  { service: "tts", label: "Text-to-Speech", provider: "LOCAL", model: "piper", status: "checking" },
];

function StatusDot({ status }: { status: ServiceConfig["status"] }): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        status === "connected" && "bg-green-500",
        status === "disconnected" && "bg-red-500",
        status === "checking" && "animate-pulse bg-yellow-400"
      )}
      title={status}
    />
  );
}

export function ProviderConfig(): React.ReactElement {
  const [configs, setConfigs] = useState<ServiceConfig[]>(DEFAULT_CONFIGS);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const checkStatus = useCallback(async (service: string): Promise<"connected" | "disconnected"> => {
    try {
      await apiClient.get(`/api/v1/providers/${service}/status`);
      return "connected";
    } catch {
      return "disconnected";
    }
  }, []);

  useEffect(() => {
    async function loadStatuses(): Promise<void> {
      const updated = await Promise.all(
        configs.map(async (c) => ({
          ...c,
          status: await checkStatus(c.service),
        }))
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
        // Reset model to first available for the new provider
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

  async function handleSave(service: string): Promise<void> {
    const config = configs.find((c) => c.service === service);
    if (!config) return;

    setSaving(service);
    setMessage(null);

    const result = await saveProviderConfig(service, config.provider, config.model);

    if (result.success) {
      setMessage({ type: "success", text: `${config.label} configuration saved.` });
      // Re-check status
      const status = await checkStatus(service);
      setConfigs((prev) =>
        prev.map((c) => (c.service === service ? { ...c, status } : c))
      );
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to save configuration." });
    }

    setSaving(null);
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
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

          return (
            <div
              key={config.service}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {config.label}
                </h3>
                <StatusDot status={config.status} />
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor={`provider-${config.service}`}
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Provider
                  </label>
                  <select
                    id={`provider-${config.service}`}
                    value={config.provider}
                    onChange={(e) => handleProviderChange(config.service, e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Model
                  </label>
                  <select
                    id={`model-${config.service}`}
                    value={config.model}
                    onChange={(e) => handleModelChange(config.service, e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {availableModels.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handleSave(config.service)}
                  disabled={saving === config.service}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
                    saving === config.service
                      ? "cursor-not-allowed bg-blue-400"
                      : "bg-blue-600 hover:bg-blue-700"
                  )}
                >
                  {saving === config.service ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Configuration"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
