export default function PipelineLoading(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="animate-pulse glass-card luminous-border rounded-xl p-6"
          >
            <div className="h-4 w-28 rounded bg-surface-elevated" />
            <div className="mt-2 h-8 w-14 rounded bg-surface-elevated" />
            <div className="mt-1 h-3 w-36 rounded bg-surface-elevated" />
          </div>
        ))}
      </div>

      {/* Filter skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded bg-surface-elevated animate-pulse" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="h-6 w-16 rounded-full bg-surface-elevated animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="glass-card luminous-border overflow-hidden rounded-xl">
        {/* Table header */}
        <div className="flex gap-4 bg-surface-elevated px-6 py-3">
          <div className="h-3 w-20 rounded bg-surface-hover animate-pulse" />
          <div className="h-3 w-32 rounded bg-surface-hover animate-pulse" />
          <div className="h-3 w-20 rounded bg-surface-hover animate-pulse" />
          <div className="h-3 w-16 rounded bg-surface-hover animate-pulse" />
          <div className="h-3 w-16 rounded bg-surface-hover animate-pulse" />
          <div className="h-3 w-16 rounded bg-surface-hover animate-pulse" />
        </div>

        {/* Table rows */}
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-t border-border px-6 py-4"
          >
            {/* Title */}
            <div className="h-4 w-48 rounded bg-surface-elevated animate-pulse" />

            {/* Stage indicator skeleton */}
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, j) => (
                <div key={j} className="flex items-center">
                  {j > 0 && (
                    <div className="h-0.5 w-6 bg-surface-elevated animate-pulse" />
                  )}
                  <div className="h-7 w-7 rounded-full bg-surface-elevated animate-pulse" />
                </div>
              ))}
            </div>

            {/* Current stage */}
            <div className="h-4 w-16 rounded bg-surface-elevated animate-pulse" />

            {/* Status badge */}
            <div className="h-5 w-20 rounded-full bg-surface-elevated animate-pulse" />

            {/* Created */}
            <div className="h-4 w-14 rounded bg-surface-elevated animate-pulse" />

            {/* Duration */}
            <div className="h-4 w-12 rounded bg-surface-elevated animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
