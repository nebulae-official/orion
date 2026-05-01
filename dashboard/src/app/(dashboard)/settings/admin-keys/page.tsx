"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  KeyRound,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  listSystemKeys,
  saveSystemKey,
  type SystemKeyStatus,
} from "@/lib/actions";

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  nvidia_nim: "NVIDIA NIM",
  fal_ai: "Fal.ai",
  elevenlabs: "ElevenLabs",
  deepseek: "DeepSeek",
  groq: "Groq",
  replicate: "Replicate",
  runway: "Runway",
};

function UpdateKeyModal({
  provider,
  isConfigured,
  onClose,
  onSave,
}: {
  provider: string;
  isConfigured: boolean;
  onClose: () => void;
  onSave: (provider: string, key: string) => Promise<void>;
}): React.ReactElement {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = PROVIDER_NAMES[provider] ?? provider;

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await onSave(provider, value.trim());
    } catch {
      setError("Failed to save key. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card luminous-border w-full max-w-md rounded-xl p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-semibold text-text">
          {isConfigured ? "Update" : "Set"} Key —{" "}
          <span className="text-primary-light">{displayName}</span>
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          This key is shared across all users and encrypted before storage.
        </p>

        {isConfigured && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-elevated px-3 py-2">
            <code className="text-xs tracking-widest text-text-muted">
              ••••••••••••••••••••••••••••••••
            </code>
            <span className="ml-2 shrink-0 text-xs text-success-light">
              Configured
            </span>
          </div>
        )}

        <input
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder={
            isConfigured
              ? "Enter new key to replace existing"
              : "sk-... / nvapi-... / fal_..."
          }
          autoComplete="new-password"
          className="mb-3 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />

        {error && (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-danger-light">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!value.trim() || saving}
            loading={saving}
            className="flex-1"
          >
            Save Key
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfiguredBadge({
  configured,
}: {
  configured: boolean;
}): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        configured
          ? "bg-success-surface text-success-light glow-emerald"
          : "bg-warning-surface text-warning-light",
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          configured ? "bg-success" : "bg-warning",
        )}
      />
      {configured ? "Configured" : "Not set"}
    </span>
  );
}

export default function AdminApiKeysPage(): React.ReactElement {
  const [keys, setKeys] = useState<SystemKeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    listSystemKeys().then((data) => {
      setKeys(data);
      setLoading(false);
    });
  }, []);

  const handleSave = useCallback(
    async (provider: string, key: string) => {
      const result = await saveSystemKey(provider, key);
      setEditingProvider(null);
      if (result.success) {
        setKeys((prev) =>
          prev.map((k) =>
            k.provider === provider ? { ...k, is_configured: true } : k,
          ),
        );
        setMessage({
          type: "success",
          text: `System key for ${PROVIDER_NAMES[provider] ?? provider} saved.`,
        });
      } else {
        setMessage({
          type: "error",
          text: result.error ?? "Failed to save key.",
        });
      }
      setTimeout(() => setMessage(null), 4000);
    },
    [],
  );

  const editingKey = editingProvider
    ? keys.find((k) => k.provider === editingProvider)
    : null;

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-surface">
            <KeyRound className="h-6 w-6 text-primary-light" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">
              System API Keys
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Keys configured here are used as defaults for all users. Users can
              override with personal keys in their own settings.
            </p>
          </div>
        </div>
      </div>

      {/* Security warning */}
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <p className="text-sm text-warning-light">
          These keys are stored encrypted. Never share them. Keys are masked and
          cannot be retrieved once saved.
        </p>
      </div>

      {/* Encrypted storage notice */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-success/30 bg-success-surface px-4 py-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div>
          <p className="text-sm font-medium text-success-light">
            Encrypted Storage
          </p>
          <p className="mt-1 text-xs text-success-light/80">
            Keys are encrypted with Fernet AES-128 before storage. Raw keys are
            never logged or returned by any API. Per-user keys (set in Settings
            → API Keys) take priority over these system defaults.
          </p>
        </div>
      </div>

      {/* Flash message */}
      {message && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-success/30 bg-success-surface text-success-light"
              : "border-danger/30 bg-danger-surface text-danger-light",
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

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
        </div>
      ) : (
        <div className="glass-card luminous-border overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-elevated/50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-text-secondary">
                  Provider
                </th>
                <th className="px-6 py-3 text-left font-medium text-text-secondary">
                  Status
                </th>
                <th className="px-6 py-3 text-right font-medium text-text-secondary">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((entry) => (
                <tr
                  key={entry.provider}
                  className="transition-colors hover:bg-surface-hover/40"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-text">
                      {PROVIDER_NAMES[entry.provider] ?? entry.provider}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-text-dim">
                      {entry.provider}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <ConfiguredBadge configured={entry.is_configured} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingProvider(entry.provider)}
                    >
                      {entry.is_configured ? "Update" : "Set Key"}
                    </Button>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-8 text-center text-text-muted"
                  >
                    No providers found. Ensure the Identity service is running.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {editingProvider && editingKey && (
        <UpdateKeyModal
          provider={editingProvider}
          isConfigured={editingKey.is_configured}
          onClose={() => setEditingProvider(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
