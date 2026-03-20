export default function VideoLoading(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="animate-pulse glass-card luminous-border rounded-xl p-6"
          >
            <div className="h-4 w-24 rounded bg-surface-elevated" />
            <div className="mt-2 h-8 w-16 rounded bg-surface-elevated" />
            <div className="mt-1 h-3 w-32 rounded bg-surface-elevated" />
          </div>
        ))}
      </div>

      {/* Active renders section skeleton */}
      <div>
        <div className="mb-3 h-6 w-36 animate-pulse rounded bg-surface-elevated" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="animate-pulse glass-card luminous-border rounded-xl p-6"
            >
              {/* Title row */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded bg-surface-elevated" />
                  <div>
                    <div className="h-4 w-48 rounded bg-surface-elevated" />
                    <div className="mt-1 h-3 w-16 rounded bg-surface-elevated" />
                  </div>
                </div>
                <div className="h-5 w-20 rounded-full bg-surface-elevated" />
              </div>

              {/* Stage tracker placeholder */}
              <div className="mb-4 flex items-center justify-center gap-0">
                {Array.from({ length: 3 }, (_, j) => (
                  <div key={j} className="flex items-center">
                    {j > 0 && (
                      <div className="h-0.5 min-w-8 sm:min-w-12 bg-surface-elevated" />
                    )}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="h-8 w-8 rounded-full bg-surface-elevated" />
                      <div className="h-3 w-12 rounded bg-surface-elevated" />
                      <div className="h-2.5 w-16 rounded bg-surface-elevated" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar placeholder */}
              <div className="h-1.5 w-full rounded-full bg-surface-elevated" />
              <div className="mt-1.5 flex justify-end">
                <div className="h-2.5 w-16 rounded bg-surface-elevated" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Render history table skeleton */}
      <div>
        <div className="mb-3 h-6 w-36 animate-pulse rounded bg-surface-elevated" />
        <div className="glass-card luminous-border overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-elevated">
                <tr>
                  {["Content Title", "Status", "Duration", "Output Format", "Completed At"].map(
                    (header) => (
                      <th
                        key={header}
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 w-48 rounded bg-surface-elevated" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 w-20 rounded-full bg-surface-elevated" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 rounded bg-surface-elevated" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 w-10 rounded bg-surface-elevated" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 rounded bg-surface-elevated" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
