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
  ShieldCheck,
  Info,
} from "lucide-react";
import { saveApiKey, deleteApiKey, listApiKeys, type StoredKeyMeta } from "@/lib/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KeyStatus = "saved" | "not-set";

interface ApiKeyEntry {
  provider: string;
  label: string;
  description: string;
  status: KeyStatus;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Canonical provider slugs that match Identity service ALLOWED_PROVIDERS (Tier 1 free stack). */
const DEFAULT_ENTRIES: ApiKeyEntry[] = [
  {
    provider: "nvidia_nim",
    label: "NVIDIA NIM",
    description: "LLM + Image + TTS (free tier)",
    status: "not-set",
  },
  {
    provider: "huggingface",
    label: "HuggingFace",
    description: "Image generation fallback (free)",
    status: "not-set",
  },
];

const DEMO_ENTRIES: ApiKeyEntry[] = [
  { provider: "nvidia_nim", label: "NVIDIA NIM", description: "LLM + Image + TTS (free tier)", status: "saved" },
  { provider: "huggingface", label: "HuggingFace", description: "Image generation fallback (free)", status: "not-set" },
];

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
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(!DEMO_MODE);

  // Load stored key metadata from Identity service on mount.
  useEffect(() => {
    if (DEMO_MODE) return;

    let cancelled = false;
    listApiKeys().then((storedKeys: StoredKeyMeta[]) => {
      if (cancelled) return;
      const storedProviders = new Set(storedKeys.map((k) => k.provider));
      setEntries((prev) =>
        prev.map((e) => ({
          ...e,
          status: storedProviders.has(e.provider) ? ("saved" as KeyStatus) : ("not-set" as KeyStatus),
        }))
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveKey = useCallback(
    async (provider: string) => {
      if (!editValue.trim()) return;
      setSaving(provider);
      const result = await saveApiKey(provider, editValue.trim());
      setSaving(null);

      if (result.success) {
        setEntries((prev) =>
          prev.map((e) =>
            e.provider === provider ? { ...e, status: "saved" as KeyStatus } : e
          )
        );
        setEditingProvider(null);
        setEditValue("");
        setMessage({ type: "success", text: `${provider} API key saved securely.` });
      } else {
        setMessage({ type: "error", text: result.error ?? "Failed to save key." });
      }
      setTimeout(() => setMessage(null), 4000);
    },
    [editValue]
  );

  const handleDeleteKey = useCallback(async (provider: string) => {
    setDeleting(provider);
    const result = await deleteApiKey(provider);
    setDeleting(null);

    if (result.success) {
      setEntries((prev) =>
        prev.map((e) =>
          e.provider === provider ? { ...e, status: "not-set" as KeyStatus } : e
        )
      );
      setMessage({ type: "success", text: `${provider} API key removed.` });
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to delete key." });
    }
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const toggleShowKey = useCallback((provider: string) => {
    setShowKey((prev) => ({ ...prev, [provider]: !prev[provider] }));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subtitle */}
      <p className="text-sm text-text-muted">
        Your personal keys override system defaults. Leave blank to use system keys.
      </p>

      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-surface px-4 py-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div>
          <p className="text-sm font-medium text-success-light">Encrypted Storage</p>
          <p className="mt-1 text-xs text-success-light/80">
            Keys are encrypted with Fernet AES-128 before being written to the database.
            They are never stored in the browser and are only decrypted server-side when
            a pipeline job needs them.
          </p>
        </div>
      </div>

      {/* Storage location badge */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Info className="h-3.5 w-3.5" />
        Keys stored encrypted in Identity service database
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
          const isSaving = saving === entry.provider;
          const isDeleting = deleting === entry.provider;

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
                      type="password"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={`Paste ${entry.label} API key`}
                      className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveKey(entry.provider)}
                        disabled={!editValue.trim() || isSaving}
                        className="flex-1"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save Key"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingProvider(null);
                          setEditValue("");
                        }}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {entry.status === "saved" ? (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded-lg bg-surface-elevated px-3 py-2 text-xs text-text-secondary">
                          {showKey[entry.provider] ? "(key visible only while editing)" : "••••••••••••••••••••••••••••••••"}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleShowKey(entry.provider)}
                          title={showKey[entry.provider] ? "Hide indicator" : "Show indicator"}
                        >
                          {showKey[entry.provider] ? (
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
                      {entry.status === "saved" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingProvider(entry.provider);
                            setEditValue("");
                          }}
                          className="flex-1"
                        >
                          Update Key
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            setEditingProvider(entry.provider);
                            setEditValue("");
                          }}
                          className="flex-1"
                        >
                          Add Key
                        </Button>
                      )}
                      {entry.status === "saved" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteKey(entry.provider)}
                          disabled={isDeleting}
                          title="Delete key"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
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
        status === "saved" && "bg-success-surface text-success-light",
        status === "not-set" && "bg-surface-elevated text-text-dim"
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          status === "saved" && "bg-success",
          status === "not-set" && "bg-text-dim"
        )}
      />
      {status === "saved" && "Saved"}
      {status === "not-set" && "Not Set"}
    </span>
  );
}
