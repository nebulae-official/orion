"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Cpu, KeyRound, Workflow, Settings } from "lucide-react";

export type SettingsTab = "providers" | "api-keys" | "pipeline" | "system";

interface TabDefinition {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDefinition[] = [
  { id: "providers", label: "Providers", icon: <Cpu className="h-4 w-4" /> },
  { id: "api-keys", label: "API Keys", icon: <KeyRound className="h-4 w-4" /> },
  { id: "pipeline", label: "Pipeline", icon: <Workflow className="h-4 w-4" /> },
  { id: "system", label: "System", icon: <Settings className="h-4 w-4" /> },
];

function getTabFromHash(): SettingsTab {
  if (typeof window === "undefined") return "providers";
  const hash = window.location.hash.replace("#", "");
  const valid: SettingsTab[] = ["providers", "api-keys", "pipeline", "system"];
  return valid.includes(hash as SettingsTab) ? (hash as SettingsTab) : "providers";
}

interface SettingsTabsProps {
  children: (activeTab: SettingsTab) => React.ReactNode;
}

export function SettingsTabs({ children }: SettingsTabsProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");

  useEffect(() => {
    setActiveTab(getTabFromHash());

    function onHashChange(): void {
      setActiveTab(getTabFromHash());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleTabClick = useCallback((tab: SettingsTab) => {
    window.location.hash = tab;
    setActiveTab(tab);
  }, []);

  return (
    <div>
      <div className="mb-6 border-b border-border">
        <nav className="-mb-px flex gap-1" aria-label="Settings tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:border-border hover:text-text"
              )}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div role="tabpanel">{children(activeTab)}</div>
    </div>
  );
}
