"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DEMO_MODE } from "@/lib/config";
import {
  Check,
  AlertCircle,
  RotateCcw,
  Info,
  Zap,
  Radar,
  Send,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentGeneration {
  maxConcurrentPipelines: number;
  defaultQuality: "draft" | "standard" | "premium";
  autoApproveThreshold: number;
  maxRetryAttempts: number;
}

interface TrendDetection {
  scanIntervalMinutes: number;
  minViralityScore: number;
  maxTrendsPerScan: number;
  sourceWeights: {
    rss: number;
    googleTrends: number;
    twitter: number;
  };
}

interface Publishing {
  enabledPlatforms: {
    youtube: boolean;
    tiktok: boolean;
    twitter: boolean;
    instagram: boolean;
  };
  scheduleMode: "immediate" | "scheduled" | "manual";
  rateLimits: {
    youtube: number;
    tiktok: number;
    twitter: number;
    instagram: number;
  };
}

interface PipelineSettings {
  contentGeneration: ContentGeneration;
  trendDetection: TrendDetection;
  publishing: Publishing;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const STORAGE_KEY = "orion:pipeline-settings";

const DEFAULT_SETTINGS: PipelineSettings = {
  contentGeneration: {
    maxConcurrentPipelines: 3,
    defaultQuality: "standard",
    autoApproveThreshold: 0.8,
    maxRetryAttempts: 3,
  },
  trendDetection: {
    scanIntervalMinutes: 30,
    minViralityScore: 0.5,
    maxTrendsPerScan: 10,
    sourceWeights: { rss: 0.3, googleTrends: 0.4, twitter: 0.3 },
  },
  publishing: {
    enabledPlatforms: { youtube: true, tiktok: true, twitter: false, instagram: false },
    scheduleMode: "scheduled",
    rateLimits: { youtube: 2, tiktok: 4, twitter: 10, instagram: 3 },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadSettings(): PipelineSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PipelineSettings;
  } catch {
    return null;
  }
}

function persistSettings(settings: PipelineSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PipelineConfig(): React.ReactElement {
  const [settings, setSettings] = useState<PipelineSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (DEMO_MODE) return;
    const saved = loadSettings();
    if (saved) setSettings(saved);
  }, []);

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const updateContentGeneration = useCallback(
    <K extends keyof ContentGeneration>(key: K, value: ContentGeneration[K]) => {
      setSettings((prev) => ({
        ...prev,
        contentGeneration: { ...prev.contentGeneration, [key]: value },
      }));
      setDirty(true);
    },
    []
  );

  const updateTrendDetection = useCallback(
    <K extends keyof TrendDetection>(key: K, value: TrendDetection[K]) => {
      setSettings((prev) => ({
        ...prev,
        trendDetection: { ...prev.trendDetection, [key]: value },
      }));
      setDirty(true);
    },
    []
  );

  const updatePublishing = useCallback(
    <K extends keyof Publishing>(key: K, value: Publishing[K]) => {
      setSettings((prev) => ({
        ...prev,
        publishing: { ...prev.publishing, [key]: value },
      }));
      setDirty(true);
    },
    []
  );

  const handleSave = useCallback(() => {
    // TODO: Replace with server action to persist pipeline settings on the backend
    persistSettings(settings);
    setDirty(false);
    showMessage("success", "Pipeline settings saved locally.");
  }, [settings, showMessage]);

  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    persistSettings(DEFAULT_SETTINGS);
    setDirty(false);
    showMessage("success", "Pipeline settings reset to defaults.");
  }, [showMessage]);

  return (
    <div className="space-y-6">
      {/* Local storage badge */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Info className="h-3.5 w-3.5" />
        Changes saved locally
      </div>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-success/30 bg-success-surface text-success-light"
              : "border-danger/30 bg-danger-surface text-danger-light"
          )}
        >
          {message.type === "success" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Content Generation */}
      <section className="glass-card luminous-border rounded-xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-surface">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text">Content Generation</h3>
            <p className="text-xs text-text-muted">Pipeline execution and quality settings</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Max Concurrent Pipelines"
            value={settings.contentGeneration.maxConcurrentPipelines}
            min={1}
            max={10}
            onChange={(v) => updateContentGeneration("maxConcurrentPipelines", v)}
          />
          <SelectField
            label="Default Content Quality"
            value={settings.contentGeneration.defaultQuality}
            options={[
              { value: "draft", label: "Draft" },
              { value: "standard", label: "Standard" },
              { value: "premium", label: "Premium" },
            ]}
            onChange={(v) => updateContentGeneration("defaultQuality", v as ContentGeneration["defaultQuality"])}
          />
          <SliderField
            label="Auto-Approve Threshold"
            value={settings.contentGeneration.autoApproveThreshold}
            min={0}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => updateContentGeneration("autoApproveThreshold", v)}
          />
          <NumberField
            label="Max Retry Attempts"
            value={settings.contentGeneration.maxRetryAttempts}
            min={1}
            max={5}
            onChange={(v) => updateContentGeneration("maxRetryAttempts", v)}
          />
        </div>
      </section>

      {/* Trend Detection */}
      <section className="glass-card luminous-border rounded-xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-surface">
            <Radar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text">Trend Detection</h3>
            <p className="text-xs text-text-muted">Scout service scanning configuration</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Scan Interval (minutes)"
            value={settings.trendDetection.scanIntervalMinutes}
            min={5}
            max={120}
            onChange={(v) => updateTrendDetection("scanIntervalMinutes", v)}
          />
          <SliderField
            label="Minimum Virality Score"
            value={settings.trendDetection.minViralityScore}
            min={0}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => updateTrendDetection("minViralityScore", v)}
          />
          <NumberField
            label="Max Trends Per Scan"
            value={settings.trendDetection.maxTrendsPerScan}
            min={1}
            max={50}
            onChange={(v) => updateTrendDetection("maxTrendsPerScan", v)}
          />
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-text-secondary">Source Weights</p>
            <div className="grid grid-cols-3 gap-3">
              {(["rss", "googleTrends", "twitter"] as const).map((source) => (
                <div key={source}>
                  <label className="mb-1 block text-xs text-text-muted">
                    {source === "googleTrends" ? "Google Trends" : source === "rss" ? "RSS" : "Twitter"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={settings.trendDetection.sourceWeights[source]}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val)) return;
                      updateTrendDetection("sourceWeights", {
                        ...settings.trendDetection.sourceWeights,
                        [source]: Math.min(1, Math.max(0, val)),
                      });
                    }}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Publishing */}
      <section className="glass-card luminous-border rounded-xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-surface">
            <Send className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text">Publishing</h3>
            <p className="text-xs text-text-muted">Platform and scheduling configuration</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enabled Platforms */}
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Enabled Platforms</p>
            <div className="flex flex-wrap gap-3">
              {(["youtube", "tiktok", "twitter", "instagram"] as const).map((platform) => (
                <label key={platform} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={settings.publishing.enabledPlatforms[platform]}
                    onChange={(e) =>
                      updatePublishing("enabledPlatforms", {
                        ...settings.publishing.enabledPlatforms,
                        [platform]: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-border text-primary accent-primary focus:ring-primary"
                  />
                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Schedule Mode"
              value={settings.publishing.scheduleMode}
              options={[
                { value: "immediate", label: "Immediate" },
                { value: "scheduled", label: "Scheduled" },
                { value: "manual", label: "Manual" },
              ]}
              onChange={(v) => updatePublishing("scheduleMode", v as Publishing["scheduleMode"])}
            />
          </div>

          {/* Rate Limits */}
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Rate Limits (posts/hour)</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["youtube", "tiktok", "twitter", "instagram"] as const).map((platform) => (
                <div key={platform}>
                  <label className="mb-1 block text-xs text-text-muted">
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={settings.publishing.rateLimits[platform]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val)) return;
                      updatePublishing("rateLimits", {
                        ...settings.publishing.rateLimits,
                        [platform]: Math.min(60, Math.max(1, val)),
                      });
                    }}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={cn(
            "flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-medium text-white transition-colors",
            dirty ? "bg-primary hover:bg-primary-muted" : "cursor-not-allowed bg-primary-muted"
          )}
        >
          <Check className="h-4 w-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Field Components
// ---------------------------------------------------------------------------

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}): React.ReactElement {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-secondary">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}): React.ReactElement {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}): React.ReactElement {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-medium text-text-secondary">{label}</label>
        <span className="text-sm font-mono text-text-muted">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}
