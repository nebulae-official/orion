interface FunnelStage {
  label: string;
  count: number;
  gradient: string;
}

interface FunnelChartProps {
  stages: FunnelStage[];
}

const MAX_BAR_PX = 120;
const MIN_BAR_PX = 14;

export function FunnelChart({ stages }: FunnelChartProps): React.ReactElement {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <p className="mb-1 text-xs font-medium tracking-widest uppercase text-text-muted">
        Pipeline Funnel
      </p>
      <p className="mb-5 font-[family-name:var(--font-headline)] text-base font-semibold text-text">
        Trend → Publish conversion
      </p>

      <div
        className="grid items-end gap-0.5"
        style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)`, height: `${MAX_BAR_PX}px` }}
      >
        {stages.map((stage) => {
          const height = Math.max(
            MIN_BAR_PX,
            Math.round((stage.count / maxCount) * MAX_BAR_PX),
          );
          return (
            <div key={stage.label} className="flex flex-col items-center justify-end h-full">
              <div
                className="w-full rounded-t-md relative"
                style={{
                  height: `${height}px`,
                  background: stage.gradient,
                }}
              >
                <span
                  className="absolute bottom-1.5 left-0 right-0 text-center font-[family-name:var(--font-headline)] text-[11px] font-bold text-white"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                >
                  {stage.count.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-2 grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}
      >
        {stages.map((stage) => (
          <p
            key={stage.label}
            className="text-center font-[family-name:var(--font-headline)] text-[10px] uppercase tracking-wider text-text-muted"
          >
            {stage.label}
          </p>
        ))}
      </div>
    </div>
  );
}
