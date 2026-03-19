function Skeleton({ className }: { className?: string }): React.ReactElement {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-elevated ${className ?? ""}`}
    />
  );
}

export default function MediaLoading(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Provider card skeletons */}
      <section>
        <Skeleton className="mb-3 h-6 w-24" />
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="glass-card luminous-border flex min-w-[220px] flex-1 items-start gap-4 rounded-xl p-4"
            >
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3.5 w-16" />
                <div className="flex gap-1">
                  <Skeleton className="h-4 w-14 rounded" />
                  <Skeleton className="h-4 w-12 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stat card skeletons */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-card luminous-border rounded-xl p-6"
            >
              <Skeleton className="mb-2 h-4 w-32" />
              <Skeleton className="mb-1 h-8 w-16" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </section>

      {/* Batch progress skeletons */}
      <section>
        <Skeleton className="mb-3 h-6 w-28" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="glass-card luminous-border rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <Skeleton className="mt-2 h-3 w-32" />
            </div>
          ))}
        </div>
      </section>

      {/* Image grid skeletons */}
      <section>
        <Skeleton className="mb-3 h-6 w-36" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="glass-card luminous-border overflow-hidden rounded-xl"
            >
              <Skeleton className="h-32 w-full rounded-none" />
              <div className="space-y-1.5 p-3">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-12" />
                  <Skeleton className="h-3.5 w-10 rounded-full" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
