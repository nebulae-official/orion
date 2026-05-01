"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, KeyRound, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { listSystemKeys, saveSystemKey, type SystemKeyStatus } from "@/lib/actions";

function UpdateKeyModal({
  provider,
  onClose,
  onSave,
}: {
  provider: string;
  onClose: () => void;
  onSave: (provider: string, key: string) => Promise<void>;
}): React.ReactElement {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setSaving(true);
    await onSave(provider, value.trim());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-text">
          Set system key for <span className="text-primary">{provider}</span>
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          This key is shared across all users. It will be encrypted before storage.
        </p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste API key"
          className="mb-4 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!value.trim() || saving}
            className="flex-1"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Key"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfiguredBadge({ configured }: { configured: boolean }): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        configured ? "bg-success-surface text-success-light" : "bg-surface-elevated text-text-dim",
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          configured ? "bg-success" : "bg-text-dim",
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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    listSystemKeys().then((data) => {
      setKeys(data);
      setLoading(false);
    });
  }, []);

  const handleSave = useCallback(async (provider: string, key: string) => {
    const result = await saveSystemKey(provider, key);
    setEditingProvider(null);
    if (result.success) {
      setKeys((prev) =>
        prev.map((k) => (k.provider === provider ? { ...k, is_configured: true } : k)),
      );
      setMessage({ type: "success", text: `System key for ${provider} saved.` });
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to save key." });
    }
    setTimeout(() => setMessage(null), 4000);
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <KeyRound className="h-8 w-8 text-text-secondary" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">
              Admin API Keys
            </h1>
            <p className="mt-1 text-text-secondary">
              System-level provider keys shared across all users. Rotatable without restarting services.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-success/30 bg-success-surface px-4 py-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div>
          <p className="text-sm font-medium text-success-light">Encrypted Storage</p>
          <p className="mt-1 text-xs text-success-light/80">
            Keys are encrypted with Fernet AES-128 before storage. Raw keys are never logged or
            returned by any API. Per-user keys (set in Settings → API Keys) take priority over these
            system defaults.
          </p>
        </div>
      </div>

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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-elevated">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-text-secondary">Provider</th>
                <th className="px-6 py-3 text-left font-medium text-text-secondary">Status</th>
                <th className="px-6 py-3 text-right font-medium text-text-secondary">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((entry) => (
                <tr key={entry.provider} className="bg-surface hover:bg-surface-elevated/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-text">{entry.provider}</td>
                  <td className="px-6 py-4">
                    <ConfiguredBadge configured={entry.is_configured} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      size="sm"
                      variant={entry.is_configured ? "outline" : "default"}
                      onClick={() => setEditingProvider(entry.provider)}
                    >
                      {entry.is_configured ? "Update" : "Set Key"}
                    </Button>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-text-muted">
                    No providers found. Ensure the Identity service is running.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingProvider && (
        <UpdateKeyModal
          provider={editingProvider}
          onClose={() => setEditingProvider(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
