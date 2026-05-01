import { cn } from "@/lib/utils";

export function GenerationCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn("generation-card rounded-xl", className)}>
      {children}
    </div>
  );
}

export function GenerationEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "font-[family-name:var(--font-label)] text-[10px] font-medium uppercase tracking-[0.2em] text-primary-light",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function GenerationBadge({
  children,
  tone = "violet",
  className,
}: {
  children: React.ReactNode;
  tone?: "violet" | "green" | "amber" | "blue" | "red" | "grey";
  className?: string;
}): React.ReactElement {
  const tones = {
    violet: "bg-primary-surface text-primary-light",
    green: "bg-success-surface text-success-light",
    amber: "bg-warning-surface text-warning-light",
    blue: "bg-info-surface text-info-light",
    red: "bg-danger-surface text-danger-light",
    grey: "border border-border bg-surface-elevated text-text-secondary",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function GenerationProgressTrack({
  value,
  tone = "violet",
}: {
  value: number;
  tone?: "violet" | "green" | "amber" | "cyan" | "red";
}): React.ReactElement {
  const fills = {
    violet: "bg-primary glass-fill-primary",
    green: "bg-success-light glass-fill-success",
    amber: "bg-warning-light glass-fill-warning",
    cyan: "bg-cyan glass-fill-cyan",
    red: "bg-danger-light glass-fill-danger",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full glass-track">
      <div
        className={cn("h-full rounded-full transition-all duration-500", fills[tone])}
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}

export function GenerationStatusDot({
  tone = "green",
  pulse = false,
}: {
  tone?: "green" | "amber" | "grey" | "red" | "cyan" | "violet";
  pulse?: boolean;
}): React.ReactElement {
  const tones = {
    green: "bg-success-light glow-emerald",
    amber: "bg-warning-light glow-amber",
    grey: "bg-text-muted",
    red: "bg-danger-light glow-danger",
    cyan: "bg-cyan-light glow-cyan",
    violet: "bg-primary-light glow-violet",
  };

  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        tones[tone],
        pulse && "generation-pulse",
      )}
    />
  );
}

export function GenerationSectionHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn("mb-3 flex items-center gap-4", className)}>
      <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
        {children}
      </h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
