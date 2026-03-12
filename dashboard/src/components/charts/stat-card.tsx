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
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
      )}
    </div>
  );
}
