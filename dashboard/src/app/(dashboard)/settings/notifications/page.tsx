"use client";

import { useState, useEffect } from "react";

interface NotificationPreference {
  enabled: boolean;
  push: boolean;
}

interface Preferences {
  trend_detected: NotificationPreference;
  content_published: NotificationPreference;
  content_rejected: NotificationPreference;
  media_failed: NotificationPreference;
  pipeline_stage_changed: NotificationPreference;
  content_created: NotificationPreference;
}

const DEFAULT_PREFS: Preferences = {
  trend_detected: { enabled: true, push: true },
  content_published: { enabled: true, push: true },
  content_rejected: { enabled: true, push: true },
  media_failed: { enabled: true, push: true },
  pipeline_stage_changed: { enabled: false, push: false },
  content_created: { enabled: false, push: false },
};

const LABELS: Record<keyof Preferences, string> = {
  trend_detected: "Trend Detected",
  content_published: "Content Published",
  content_rejected: "Content Rejected",
  media_failed: "Media Generation Failed",
  pipeline_stage_changed: "Pipeline Stage Changed",
  content_created: "Content Created",
};

export default function NotificationPreferencesPage(): React.ReactElement {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/v1/identity/notifications/preferences")
      .then((res) => (res.ok ? res.json() : DEFAULT_PREFS))
      .then((data) => setPrefs({ ...DEFAULT_PREFS, ...data }))
      .catch(() => {});
  }, []);

  const toggle = (
    key: keyof Preferences,
    field: "enabled" | "push",
    value: boolean
  ) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/v1/identity/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
    } catch {
      // silently fail
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Notification Preferences</h2>
        <p className="text-sm text-text-muted mt-1">
          Control which notifications you receive and how they are delivered.
        </p>
      </div>

      <div className="space-y-4">
        {(Object.keys(LABELS) as (keyof Preferences)[]).map((key) => (
          <div
            key={key}
            className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-[var(--ds-surface-container)]"
          >
            <span className="text-sm font-medium">{LABELS[key]}</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={prefs[key].enabled}
                  onChange={(e) => toggle(key, "enabled", e.target.checked)}
                  className="rounded"
                />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={prefs[key].push}
                  onChange={(e) => toggle(key, "push", e.target.checked)}
                  disabled={!prefs[key].enabled}
                  className="rounded"
                />
                Real-time
              </label>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-[var(--ds-primary)] text-[var(--ds-on-primary)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Preferences"}
      </button>
    </div>
  );
}
