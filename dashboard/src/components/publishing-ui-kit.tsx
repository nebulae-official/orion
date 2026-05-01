import type React from "react";
import { cn } from "@/lib/utils";
import { GenerationBadge } from "@/components/generation-ui-kit";

// ── Platform Summary Card ─────────────────────────────────────────────────────

interface PlatformSummaryCardProps {
  label: string;
  icon: string;
  iconStyle: React.CSSProperties;
  published: number;
  queued: number;
  connected: boolean;
}

export function PlatformSummaryCard({
  label,
  icon,
  iconStyle,
  published,
  queued,
  connected,
}: PlatformSummaryCardProps): React.ReactElement {
  return (
    <div className="generation-card flex items-center gap-4 rounded-xl p-5">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-xl"
        style={iconStyle}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-text">
          {label}
        </div>
        <div className="mt-0.5 text-xs text-text-muted">
          {connected
            ? `${published} published · ${queued} queued`
            : "Not configured"}
        </div>
        <div className="mt-1.5">
          <GenerationBadge
            tone={connected ? "green" : "grey"}
            className="text-[11px]"
          >
            {connected ? "Connected" : "Disabled"}
          </GenerationBadge>
        </div>
      </div>
    </div>
  );
}

// ── Publish Status Badge ──────────────────────────────────────────────────────

type PublishStatusVariant = "live" | "published" | "scheduled" | "failed";

const STATUS_CONFIG: Record<
  PublishStatusVariant,
  { label: string; icon: string; tone: "blue" | "green" | "amber" | "red" }
> = {
  live: { label: "Live", icon: "📡", tone: "blue" },
  published: { label: "Published", icon: "✓", tone: "green" },
  scheduled: { label: "Scheduled", icon: "⏱", tone: "amber" },
  failed: { label: "Failed", icon: "✕", tone: "red" },
};

interface PublishStatusBadgeProps {
  variant: PublishStatusVariant;
}

export function PublishStatusBadge({
  variant,
}: PublishStatusBadgeProps): React.ReactElement {
  const { label, icon, tone } = STATUS_CONFIG[variant];
  return (
    <GenerationBadge tone={tone}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </GenerationBadge>
  );
}

// ── Platform Badge ────────────────────────────────────────────────────────────

const PLATFORM_DISPLAY: Record<string, { icon: string; label: string }> = {
  twitter: { icon: "𝕏", label: "Twitter" },
  youtube: { icon: "▶", label: "YouTube" },
  tiktok: { icon: "♪", label: "TikTok" },
  linkedin: { icon: "in", label: "LinkedIn" },
  instagram: { icon: "◉", label: "Instagram" },
};

interface PlatformBadgeProps {
  platform: string;
}

export function PlatformBadge({
  platform,
}: PlatformBadgeProps): React.ReactElement {
  const meta = PLATFORM_DISPLAY[platform] ?? {
    icon: "○",
    label: platform.charAt(0).toUpperCase() + platform.slice(1),
  };
  return (
    <GenerationBadge tone="grey">
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </GenerationBadge>
  );
}

// ── Ghost button for table header actions ─────────────────────────────────────

interface GhostButtonProps {
  children: React.ReactNode;
  className?: string;
}

export function GhostButton({
  children,
  className,
}: GhostButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md border border-border bg-transparent px-3.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-light hover:text-text",
        className,
      )}
    >
      {children}
    </button>
  );
}
