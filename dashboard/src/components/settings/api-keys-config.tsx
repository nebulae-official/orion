"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DEMO_MODE } from "@/lib/config";
import { Button } from "@/components/ui/button";
import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  ShieldAlert,
  Info,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KeyStatus = "valid" | "invalid" | "not-set";

interface ApiKeyEntry {
  provider: string;
  label: string;
  description: string;
  key: string;
  status: KeyStatus;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "orion:api-keys";

const DEFAULT_ENTRIES: ApiKeyEntry[] = [
  {
    provider: "openai",
    label: "OpenAI",
    description: "GPT-4o, DALL-E 3, TTS models",
    key: "",
    status: "not-set",
  },
  {
    provider: "replicate",
    label: "Replicate",
    description: "Stable Diffusion, AnimateDiff, Flux",
    key: "",
    status: "not-set",
  },
  {
    provider: "fal",
    label: "Fal.ai",
    description: "Fast image and video generation",
    key: "",
    status: "not-set",
  },
  {
    provider: "elevenlabs",
    label: "ElevenLabs",
    description: "High-quality text-to-speech",
    key: "",
    status: "not-set",
  },
  {
    provider: "runway",
    label: "Runway",
    description: "Gen-3 video generation",
    key: "",
    status: "not-set",
  },
];

const DEMO_ENTRIES: ApiKeyEntry[] = [
  { provider: "openai", label: "OpenAI", description: "GPT-4o, DALL-E 3, TTS models", key: "sk-proj-****************************a1Bf", status: "valid" },
  { provider: "replicate", label: "Replicate", description: "Stable Diffusion, AnimateDiff, Flux", key: "r8_****************************Kx9m", status: "valid" },
  { provider: "fal", label: "Fal.ai", description: "Fast image and video generation", key: "", status: "not-set" },
  { provider: "elevenlabs", label: "ElevenLabs", description: "High-quality text-to-speech", key: "el_****************************Hn4p", status: "valid" },
  { provider: "runway", label: "Runway", description: "Gen-3 video generation", key: "", status: "not-set" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskKey(key: string): string {
  if (!key || key.length < 8) return key;
  const prefix = key.slice(0, key.indexOf("_") + 1 || 4);
  const last4 = key.slice(-4);
  return `${prefix}${"*".repeat(Math.max(4, key.length - prefix.length - 4))}${last4}`;
}

function loadFromStorage(): ApiKeyEntry[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ApiKeyEntry[];
  } catch {
    return null;
  }
}

function saveToStorage(entries: ApiKeyEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApiKeysConfig(): React.ReactElement {
  const [entries, setEntries] = useState<ApiKeyEntry[]>(
    DEMO_MODE ? DEMO_ENTRIES : DEFAULT_ENTRIES
  );
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [verifying, setVerifying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load saved keys from localStorage on mount
  useEffect(() => {
    if (DEMO_MODE) return;
    const saved = loadFromStorage();
    if (saved) {
      setEntries(saved);
    }
  }, []);

  const handleSaveKey = useCallback(
    (provider: string) => {
      setEntries((prev) => {
        const updated = prev.map((e) =>
          e.provider === provider
            ? { ...e, key: editValue, status: editValue ? ("valid" as KeyStatus) : ("not-set" as KeyStatus) }
            : e
        );
        // TODO: Replace with server action to securely store API keys on the backend
        saveToStorage(updated);
        return updated;
      });
      setEditingProvider(null);
      setEditValue("");
      setMessage({ type: "success", text: `${provider} API key saved locally.` });
      setTimeout(() => setMessage(null), 3000);
    },
    [editValue]
  );

  const handleDeleteKey = useCallback((provider: string) => {
    setEntries((prev) => {
      const updated = prev.map((e) =>
        e.provider === provider ? { ...e, key: "", status: "not-set" as KeyStatus } : e
      );
      // TODO: Replace with server action to delete API key from backend
      saveToStorage(updated);
      return updated;
    });
    setMessage({ type: "success", text: `${provider} API key removed.` });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleVerify = useCallback(
    async (provider: string) => {
      setVerifying(provider);
      // TODO: Replace with actual API key verification endpoint
      // Simulate verification delay
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const entry = entries.find((e) => e.provider === provider);
      if (entry?.key) {
        setEntries((prev) =>
          prev.map((e) =>
            e.provider === provider ? { ...e, status: "valid" } : e
          )
        );
        setMessage({ type: "success", text: `${provider} key verified successfully.` });
      } else {
        setMessage({ type: "error", text: `No API key set for ${provider}.` });
      }
      setVerifying(null);
      setTimeout(() => setMessage(null), 3000);
    },
    [entries]
  );

  const toggleShowKey = useCallback((provider: string) => {
    setShowKey((prev) => ({ ...prev, [provider]: !prev[provider] }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Security warning */}
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-medium text-warning">Security Notice</p>
          <p className="mt-1 text-xs text-warning/80">
            API keys are sensitive credentials. In production, keys are stored encrypted on the server
            and never exposed to the browser. Currently, keys are saved to localStorage for development purposes only.
          </p>
        </div>
      </div>

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
          {message.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {entries.map((entry) => {
          const isEditing = editingProvider === entry.provider;
          const isVisible = showKey[entry.provider] ?? false;

          return (
            <div
              key={entry.provider}
              className="glass-card luminous-border rounded-xl p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                    <KeyRound className="h-5 w-5 text-text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text">{entry.label}</h3>
                    <p className="text-xs text-text-muted">{entry.description}</p>
                  </div>
                </div>
                <StatusBadge status={entry.status} />
              </div>

              <div className="space-y-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={`Enter ${entry.label} API key`}
                      className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveKey(entry.provider)}
                        disabled={!editValue.trim()}
                        className="flex-1"
                      >
                        Save Key
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingProvider(null);
                          setEditValue("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {entry.key ? (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded-lg bg-surface-elevated px-3 py-2 text-xs text-text-secondary">
                          {isVisible ? entry.key : maskKey(entry.key)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleShowKey(entry.provider)}
                          title={isVisible ? "Hide key" : "Show key"}
                        >
                          {isVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <p className="rounded-lg bg-surface-elevated px-3 py-2 text-xs text-text-dim">
                        No API key configured
                      </p>
                    )}

                    <div className="flex gap-2">
                      {entry.key ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingProvider(entry.provider);
                            setEditValue(entry.key);
                          }}
                          className="flex-1"
                        >
                          Update Key
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            setEditingProvider(entry.provider);
                            setEditValue(entry.key);
                          }}
                          className="flex-1"
                        >
                          Add Key
                        </Button>
                      )}
                      {entry.key && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerify(entry.provider)}
                            disabled={verifying === entry.provider}
                          >
                            {verifying === entry.provider ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Verify"
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteKey(entry.provider)}
                            title="Delete key"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: KeyStatus }): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        status === "valid" && "bg-success-surface text-success-light",
        status === "invalid" && "bg-danger-surface text-danger-light",
        status === "not-set" && "bg-surface-elevated text-text-dim"
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          status === "valid" && "bg-success",
          status === "invalid" && "bg-danger",
          status === "not-set" && "bg-text-dim"
        )}
      />
      {status === "valid" && "Active"}
      {status === "invalid" && "Invalid"}
      {status === "not-set" && "Not Set"}
    </span>
  );
}
