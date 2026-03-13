export default function DashboardLoading(): React.ReactElement {
  return (
    <div className="p-8">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-elevated" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-surface-elevated" />
      </div>

      {/* Stat cards skeleton */}
      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border bg-surface p-6"
          >
            <div className="h-4 w-24 rounded bg-surface-elevated" />
            <div className="mt-2 h-8 w-16 rounded bg-surface-elevated" />
          </div>
        ))}
      </div>

      {/* Content cards skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border bg-surface shadow-sm"
          >
            <div className="aspect-video w-full rounded-t-xl bg-surface-elevated" />
            <div className="p-4">
              <div className="mb-2 h-5 w-20 rounded-full bg-surface-elevated" />
              <div className="h-4 w-3/4 rounded bg-surface-elevated" />
              <div className="mt-2 h-3 w-full rounded bg-surface-elevated" />
              <div className="mt-3 h-3 w-16 rounded bg-surface-elevated" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
