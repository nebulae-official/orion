"use client";

import { useState, useEffect, useCallback } from "react";
import { DEMO_MODE } from "@/lib/config";
import { SettingsSidebarNav, type SettingsPanel } from "@/components/settings/settings-sidebar-nav";
import { ApiKeysPanel } from "@/components/settings/settings-api-keys-panel";
import { ProviderConfig } from "@/components/provider-config";
import { PipelineConfig } from "@/components/settings/pipeline-config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPanelFromHash(): SettingsPanel {
  if (typeof window === "undefined") return "api-keys";
  const hash = window.location.hash.replace("#", "");
  const valid: SettingsPanel[] = [
    "api-keys",
    "providers",
    "pipeline",
    "profile",
    "notifications",
  ];
  return valid.includes(hash as SettingsPanel) ? (hash as SettingsPanel) : "api-keys";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SettingsContent(): React.ReactElement {
  const [activePanel, setActivePanel] = useState<SettingsPanel>("api-keys");

  useEffect(() => {
    setActivePanel(getPanelFromHash());

    function onHashChange(): void {
      setActivePanel(getPanelFromHash());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleNavigate = useCallback((panel: SettingsPanel) => {
    window.location.hash = panel;
    setActivePanel(panel);
  }, []);

  return (
    <div className="grid grid-cols-[220px_1fr] gap-6">
      <SettingsSidebarNav activePanel={activePanel} onNavigate={handleNavigate} />
      <div className="glass-card luminous-border min-h-0 rounded-xl p-6">
        <ActivePanel panel={activePanel} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel dispatcher
// ---------------------------------------------------------------------------

function ActivePanel({ panel }: { panel: SettingsPanel }): React.ReactElement {
  switch (panel) {
    case "api-keys":
      return <ApiKeysPanel />;
    case "providers":
      return <ProviderConfig />;
    case "pipeline":
      return <PipelineConfig />;
    case "profile":
      return <ProfilePanel />;
    case "notifications":
      return <NotificationsPanel />;
  }
}

// ---------------------------------------------------------------------------
// Profile panel
// ---------------------------------------------------------------------------

const DEMO_USER = {
  name: "Demo User",
  email: "demo@orion.ai",
  role: "Admin",
  initials: "DU",
};

function ProfilePanel(): React.ReactElement {
  const user = DEMO_MODE ? DEMO_USER : null;

  return (
    <div className="space-y-6">
      <PanelSectionHeading>Profile</PanelSectionHeading>

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-surface text-lg font-bold text-primary-light">
          {user?.initials ?? "?"}
        </div>
        <div>
          <p className="text-base font-semibold text-text">
            {user?.name ?? "—"}
          </p>
          <p className="text-sm text-text-secondary">{user?.email ?? "—"}</p>
        </div>
      </div>

      <div className="space-y-4">
        <ProfileField label="Display name" value={user?.name ?? ""} />
        <ProfileField label="Email" value={user?.email ?? ""} type="email" />
        <ProfileField label="Role" value={user?.role ?? ""} readOnly />
      </div>

      {DEMO_MODE && (
        <p className="text-xs text-text-muted">
          Profile editing is disabled in demo mode.
        </p>
      )}
    </div>
  );
}

function ProfileField({
  label,
  value,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  type?: string;
  readOnly?: boolean;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-medium text-text-secondary">
        {label}
      </label>
      <input
        type={type}
        defaultValue={value}
        readOnly={readOnly || DEMO_MODE}
        className="rounded-lg border border-border bg-surface-elevated px-3.5 py-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-1 focus:ring-primary read-only:cursor-default read-only:opacity-70"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications panel
// ---------------------------------------------------------------------------

interface NotificationEvent {
  id: string;
  label: string;
  description: string;
}

const NOTIFICATION_EVENTS: NotificationEvent[] = [
  {
    id: "trend_detected",
    label: "Trend Detected",
    description: "When Scout detects a new viral trend",
  },
  {
    id: "content_created",
    label: "Content Created",
    description: "When a new content item is generated from a trend",
  },
  {
    id: "pipeline_changed",
    label: "Pipeline Stage Changed",
    description: "When content moves to a new pipeline stage",
  },
  {
    id: "content_published",
    label: "Content Published",
    description: "When content is successfully published to platforms",
  },
  {
    id: "content_rejected",
    label: "Content Rejected",
    description: "When content fails quality checks",
  },
  {
    id: "media_failed",
    label: "Media Generation Failed",
    description: "When image or video generation encounters an error",
  },
];

function NotificationsPanel(): React.ReactElement {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e.id, true]))
  );

  const toggle = useCallback((id: string) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <div>
      <PanelSectionHeading>Notification Preferences</PanelSectionHeading>
      <p className="mb-5 text-sm text-text-secondary">
        Choose which events send you an in-app notification.
      </p>
      <div>
        {NOTIFICATION_EVENTS.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between border-b border-border/60 py-3 last:border-0"
          >
            <div>
              <p className="text-[13.5px] font-medium text-text">
                {event.label}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {event.description}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled[event.id]}
              onClick={() => toggle(event.id)}
              className={`relative h-[22px] w-10 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                enabled[event.id]
                  ? "bg-primary"
                  : "border border-border bg-surface-elevated"
              }`}
            >
              <span
                className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-200 ${
                  enabled[event.id] ? "left-[21px]" : "left-[3px]"
                }`}
              />
              <span className="sr-only">{event.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared section heading
// ---------------------------------------------------------------------------

function PanelSectionHeading({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <h2 className="mb-4 border-b border-border pb-2 font-[family-name:var(--font-display)] text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
      {children}
    </h2>
  );
}
