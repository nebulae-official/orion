interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
}: StatCardProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-sm font-medium text-text-muted">{title}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-text">{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-text-dim">{subtitle}</p>
      )}
    </div>
  );
}
