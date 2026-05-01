"use client";

import { cn } from "@/lib/utils";

export type SettingsPanel =
  | "api-keys"
  | "providers"
  | "pipeline"
  | "profile"
  | "notifications";

interface NavItem {
  id: SettingsPanel;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Configuration",
    items: [
      {
        id: "api-keys",
        label: "API Keys",
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <path d="M2 10h20" />
          </svg>
        ),
      },
      {
        id: "providers",
        label: "Providers",
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
            <path d="M7 7h.01" />
          </svg>
        ),
      },
      {
        id: "pipeline",
        label: "Pipeline",
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        id: "profile",
        label: "Profile",
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10.268 21a2 2 0 0 0 3.464 0" />
            <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
          </svg>
        ),
      },
    ],
  },
];

interface SettingsSidebarNavProps {
  activePanel: SettingsPanel;
  onNavigate: (panel: SettingsPanel) => void;
}

export function SettingsSidebarNav({
  activePanel,
  onNavigate,
}: SettingsSidebarNavProps): React.ReactElement {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Settings navigation">
      {NAV_GROUPS.map((group, groupIndex) => (
        <div key={group.label}>
          <p
            className={cn(
              "px-3.5 pb-2 font-[family-name:var(--font-display)] text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted",
              groupIndex > 0 && "pt-4"
            )}
          >
            {group.label}
          </p>
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={activePanel === item.id ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                activePanel === item.id
                  ? "bg-primary-surface text-primary-light"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
