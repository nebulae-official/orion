"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DEMO_MODE } from "@/lib/config";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiKeyRow {
  id: string;
  name: string;
  maskedKey: string;
  iconBg: string;
  iconText: string;
  iconLabel: string;
  status: "active" | "missing";
}

interface PipelineFormState {
  niche: string;
  maxJobs: number;
  imageProvider: string;
  llmModel: string;
}

interface AutomationToggle {
  id: string;
  label: string;
  subtitle: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Seed data matching the HTML reference
// ---------------------------------------------------------------------------

const DEMO_API_KEY_ROWS: ApiKeyRow[] = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    maskedKey: "sk-ant-••••••••••••3a9f",
    iconBg: "bg-success-surface",
    iconText: "text-success",
    iconLabel: "A",
    status: "active",
  },
  {
    id: "fal_ai",
    name: "Fal.ai (Image Gen)",
    maskedKey: "fal-••••••••••••8c2d",
    iconBg: "bg-info-surface",
    iconText: "text-info-light",
    iconLabel: "F",
    status: "active",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs (TTS)",
    maskedKey: "el-••••••••••••1f7a",
    iconBg: "bg-warning-surface",
    iconText: "text-warning-light",
    iconLabel: "E",
    status: "active",
  },
  {
    id: "twitter",
    name: "Twitter / X",
    maskedKey: "Not configured",
    iconBg: "bg-surface-elevated",
    iconText: "text-text-secondary",
    iconLabel: "𝕏",
    status: "missing",
  },
];

const DEFAULT_PIPELINE: PipelineFormState = {
  niche: "ai-infrastructure",
  maxJobs: 5,
  imageProvider: "fal",
  llmModel: "gpt-4o",
};

const DEFAULT_TOGGLES: AutomationToggle[] = [
  {
    id: "auto-approve",
    label: "Auto-approve high-confidence content",
    subtitle: "Approve automatically when confidence ≥ 92%",
    enabled: true,
  },
  {
    id: "daily-cadence",
    label: "Daily publish cadence",
    subtitle: "Publish up to 10 videos per day across platforms",
    enabled: true,
  },
  {
    id: "safety-checks",
    label: "Content safety checks",
    subtitle: "Run moderation before publishing",
    enabled: true,
  },
  {
    id: "local-llm",
    label: "Local LLM fallback (Ollama)",
    subtitle: "Use local model when cloud API is unavailable",
    enabled: false,
  },
];

// ---------------------------------------------------------------------------
// Field input shared style
// ---------------------------------------------------------------------------

const fieldInputClass =
  "w-full rounded-lg border border-border bg-surface-elevated px-3.5 py-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-1 focus:ring-primary";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ApiKeysPanel(): React.ReactElement {
  const [pipeline, setPipeline] = useState<PipelineFormState>(DEFAULT_PIPELINE);
  const [toggles, setToggles] = useState<AutomationToggle[]>(DEFAULT_TOGGLES);
  const [saved, setSaved] = useState(false);

  const handleToggle = useCallback((id: string) => {
    setToggles((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!DEMO_MODE) {
      // Live mode: POST /api/v1/settings with { pipeline, automation: toggles }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [pipeline, toggles]);

  const handleDiscard = useCallback(() => {
    setPipeline(DEFAULT_PIPELINE);
    setToggles(DEFAULT_TOGGLES);
  }, []);

  return (
    <div>
      {/* API Keys section */}
      <SectionHeading>API Keys</SectionHeading>
      <div className="mb-7 space-y-2.5">
        {DEMO_API_KEY_ROWS.map((row) => (
          <KeyRow key={row.id} row={row} />
        ))}
      </div>

      {/* Pipeline Configuration section */}
      <SectionHeading>Pipeline Configuration</SectionHeading>
      <div className="mb-7 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Target Niche">
            <select
              value={pipeline.niche}
              onChange={(e) =>
                setPipeline((p) => ({ ...p, niche: e.target.value }))
              }
              className={fieldInputClass}
            >
              <option value="ai-infrastructure">AI / Infrastructure</option>
              <option value="astronomy">Astronomy</option>
              <option value="dev-tools">Dev Tools</option>
            </select>
          </FieldGroup>
          <FieldGroup label="Max concurrent jobs">
            <input
              type="number"
              min={1}
              max={20}
              value={pipeline.maxJobs}
              onChange={(e) =>
                setPipeline((p) => ({
                  ...p,
                  maxJobs: Math.max(1, Number(e.target.value)),
                }))
              }
              className={fieldInputClass}
            />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Image provider">
            <select
              value={pipeline.imageProvider}
              onChange={(e) =>
                setPipeline((p) => ({ ...p, imageProvider: e.target.value }))
              }
              className={fieldInputClass}
            >
              <option value="fal">Fal.ai (cloud)</option>
              <option value="comfyui">ComfyUI (local)</option>
            </select>
          </FieldGroup>
          <FieldGroup label="LLM Model">
            <select
              value={pipeline.llmModel}
              onChange={(e) =>
                setPipeline((p) => ({ ...p, llmModel: e.target.value }))
              }
              className={fieldInputClass}
            >
              <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
            </select>
          </FieldGroup>
        </div>
      </div>

      {/* Automation Toggles section */}
      <SectionHeading>Automation Toggles</SectionHeading>
      <div className="mb-7">
        {toggles.map((toggle) => (
          <ToggleRow
            key={toggle.id}
            toggle={toggle}
            onToggle={() => handleToggle(toggle.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2.5 border-t border-border pt-3">
        <Button variant="ghost" onClick={handleDiscard}>
          Discard
        </Button>
        <Button onClick={handleSave}>{saved ? "Saved!" : "Save changes"}</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeading({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <h2 className="mb-3 border-b border-border pb-2 font-[family-name:var(--font-display)] text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
      {children}
    </h2>
  );
}

function KeyRow({ row }: { row: ApiKeyRow }): React.ReactElement {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-border bg-surface-elevated px-4 py-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
          row.iconBg,
          row.iconText
        )}
        aria-hidden
      >
        {row.iconLabel}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-text">{row.name}</div>
        <div className="mt-0.5 font-mono text-[11px] text-text-muted">
          {row.maskedKey}
        </div>
      </div>
      <StatusBadge status={row.status} />
      {row.status === "active" ? (
        <Button variant="ghost" size="sm" className="px-3 py-1.5 text-xs">
          Edit
        </Button>
      ) : (
        <Button size="sm" className="px-3.5 py-1.5 text-xs">
          Connect
        </Button>
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "active" | "missing";
}): React.ReactElement {
  if (status === "active") {
    return (
      <span className="inline-flex items-center rounded-full bg-success-surface px-2.5 py-1 text-xs font-medium text-success-light">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text-secondary">
      Missing
    </span>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-medium text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({
  toggle,
  onToggle,
}: {
  toggle: AutomationToggle;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
      <div>
        <p className="text-[13.5px] font-medium text-text">{toggle.label}</p>
        <p className="mt-0.5 text-xs text-text-muted">{toggle.subtitle}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={toggle.enabled}
        onClick={onToggle}
        className={cn(
          "relative h-[22px] w-10 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          toggle.enabled
            ? "bg-primary"
            : "border border-border bg-surface-elevated"
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-200",
            toggle.enabled ? "left-[21px]" : "left-[3px]"
          )}
        />
        <span className="sr-only">{toggle.label}</span>
      </button>
    </div>
  );
}
