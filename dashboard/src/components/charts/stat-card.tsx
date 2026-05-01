import { cn } from "@/lib/utils";

interface StatCardTrend {
  direction: "up" | "down";
  label: string;
  /** Which direction is "positive" (green). Defaults to "up". */
  positiveDirection?: "up" | "down";
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: StatCardTrend;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
}: StatCardProps): React.ReactElement {
  const isPositive = trend
    ? trend.direction === (trend.positiveDirection ?? "up")
    : null;

  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <p className="text-xs font-medium tracking-widest uppercase text-text-muted">
        {title}
      </p>
      <p className="mt-2 font-[family-name:var(--font-headline)] text-3xl font-bold text-text">
        {value}
      </p>
      {trend && (
        <p
          className={cn(
            "mt-1 text-sm",
            isPositive ? "text-success-light" : "text-danger-light",
          )}
        >
          {trend.direction === "up" ? "↑" : "↓"} {trend.label}
        </p>
      )}
      {!trend && subtitle && (
        <p className="mt-1 text-sm text-text-dim">{subtitle}</p>
      )}
    </div>
  );
}
