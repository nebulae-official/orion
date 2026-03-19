"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DEMO_MODE, GATEWAY_URL } from "@/lib/config";
import {
  Sun,
  Moon,
  Monitor,
  Bell,
  BellOff,
  Database,
  Server,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThemeMode = "auto" | "light" | "dark";

interface DashboardPreferences {
  theme: ThemeMode;
  refreshInterval: number; // seconds
  notificationsEnabled: boolean;
  defaultPage: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREFS_STORAGE_KEY = "orion:dashboard-prefs";

const DEFAULT_PREFERENCES: DashboardPreferences = {
  theme: "auto",
  refreshInterval: 5,
  notificationsEnabled: true,
  defaultPage: "/",
};

const REFRESH_OPTIONS = [
  { value: 1, label: "1 second" },
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
];

const PAGE_OPTIONS = [
  { value: "/", label: "Dashboard" },
  { value: "/queue", label: "Queue" },
  { value: "/trends", label: "Trends" },
  { value: "/analytics", label: "Analytics" },
  { value: "/publishing", label: "Publishing" },
  { value: "/settings", label: "Settings" },
];

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "auto", label: "System", icon: <Monitor className="h-4 w-4" /> },
  { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadPreferences(): DashboardPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return JSON.parse(raw) as DashboardPreferences;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(prefs: DashboardPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

function applyTheme(theme: ThemeMode): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // auto: follow system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SystemConfig(): React.ReactElement {
  const [prefs, setPrefs] = useState<DashboardPreferences>(DEFAULT_PREFERENCES);
  const [message, setMessage] = useState<{ type: "success"; text: string } | null>(null);

  useEffect(() => {
    const loaded = loadPreferences();
    setPrefs(loaded);
    applyTheme(loaded.theme);
  }, []);

  const updatePref = useCallback(
    <K extends keyof DashboardPreferences>(key: K, value: DashboardPreferences[K]) => {
      setPrefs((prev) => {
        const updated = { ...prev, [key]: value };
        savePreferences(updated);
        if (key === "theme") {
          applyTheme(value as ThemeMode);
        }
        return updated;
      });
      setMessage({ type: "success", text: "Preference saved." });
      setTimeout(() => setMessage(null), 2000);
    },
    []
  );

  const gatewayUrl = GATEWAY_URL;
  const dashboardVersion = "0.1.0";
  const demoStatus = DEMO_MODE ? "Enabled" : "Disabled";

  return (
    <div className="space-y-6">
      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-surface px-4 py-3 text-sm text-success-light">
          <Check className="h-4 w-4" />
          {message.text}
        </div>
      )}

      {/* Dashboard Preferences */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-surface">
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text">Dashboard Preferences</h3>
            <p className="text-xs text-text-muted">Appearance and behavior settings</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Theme Selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-text-secondary">Theme</label>
            <div className="flex gap-2">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updatePref("theme", opt.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                    prefs.theme === opt.value
                      ? "border-primary bg-primary-surface text-primary"
                      : "border-border text-text-secondary hover:bg-surface-elevated hover:text-text"
                  )}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Refresh Interval */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Health Check Refresh Interval
            </label>
            <select
              value={prefs.refreshInterval}
              onChange={(e) => updatePref("refreshInterval", parseInt(e.target.value, 10))}
              className="w-full max-w-xs rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {REFRESH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notifications Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-secondary">Notifications</p>
              <p className="text-xs text-text-muted">Receive alerts for pipeline events and errors</p>
            </div>
            <button
              onClick={() => updatePref("notificationsEnabled", !prefs.notificationsEnabled)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                prefs.notificationsEnabled
                  ? "border-success/30 bg-success-surface text-success-light"
                  : "border-border text-text-muted hover:bg-surface-elevated"
              )}
            >
              {prefs.notificationsEnabled ? (
                <>
                  <Bell className="h-4 w-4" />
                  Enabled
                </>
              ) : (
                <>
                  <BellOff className="h-4 w-4" />
                  Disabled
                </>
              )}
            </button>
          </div>

          {/* Default Page */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Default Page After Login
            </label>
            <select
              value={prefs.defaultPage}
              onChange={(e) => updatePref("defaultPage", e.target.value)}
              className="w-full max-w-xs rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Data Management */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-surface">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text">Data Management</h3>
            <p className="text-xs text-text-muted">Connection info and storage (read-only)</p>
          </div>
        </div>

        <div className="space-y-3">
          <InfoRow
            label="PostgreSQL"
            value={DEMO_MODE ? "demo-db:5432/orion" : (process.env.NEXT_PUBLIC_DB_HOST ?? "localhost:5432/orion")}
          />
          <InfoRow
            label="Redis"
            value={DEMO_MODE ? "demo-redis:6379" : (process.env.NEXT_PUBLIC_REDIS_HOST ?? "localhost:6379")}
          />
          <InfoRow
            label="Milvus"
            value={DEMO_MODE ? "demo-milvus:19530" : (process.env.NEXT_PUBLIC_MILVUS_HOST ?? "localhost:19530")}
          />
          <InfoRow
            label="Storage"
            value={DEMO_MODE ? "2.4 GB / 50 GB" : "N/A (connect to backend for live data)"}
          />
        </div>
      </section>

      {/* Environment Info */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-surface">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text">Environment</h3>
            <p className="text-xs text-text-muted">Runtime and deployment information</p>
          </div>
        </div>

        <div className="space-y-3">
          <InfoRow label="Gateway URL" value={gatewayUrl} />
          <InfoRow label="Dashboard Version" value={dashboardVersion} />
          <InfoRow label="Next.js" value="15.2.0" />
          <InfoRow label="React" value="19.x" />
          <InfoRow
            label="Demo Mode"
            value={demoStatus}
            valueClassName={DEMO_MODE ? "text-warning" : undefined}
          />
          <InfoRow
            label="Environment"
            value={process.env.NODE_ENV ?? "development"}
          />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InfoRow
// ---------------------------------------------------------------------------

function InfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-elevated px-4 py-2.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className={cn("text-sm font-mono text-text", valueClassName)}>{value}</span>
    </div>
  );
}
