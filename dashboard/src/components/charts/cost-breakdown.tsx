interface ProviderCostItem {
  provider: string;
  total_cost: number;
}

interface CostBreakdownProps {
  providers: ProviderCostItem[];
  totalCost: number;
}

const ROW_COLORS = [
  "linear-gradient(90deg,#7C3AED,#A78BFA)",
  "#22D3EE",
  "#F59E0B",
  "#34D399",
  "#EC4899",
];

/** Maps a raw provider name to a display-friendly label. */
function providerLabel(name: string): string {
  const map: Record<string, string> = {
    fal: "Media · Fal.ai",
    comfyui: "Media · ComfyUI",
    ollama: "Director · LLM",
    elevenlabs: "Editor · TTS",
    openai: "Director · OpenAI",
  };
  return map[name.toLowerCase()] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

export function CostBreakdown({
  providers,
  totalCost,
}: CostBreakdownProps): React.ReactElement {
  const rows = [...providers]
    .filter((p) => p.total_cost > 0)
    .sort((a, b) => b.total_cost - a.total_cost)
    .map((p, i) => ({
      label: providerLabel(p.provider),
      pct: totalCost > 0 ? Math.round((p.total_cost / totalCost) * 100) : 0,
      cost: p.total_cost,
      color: ROW_COLORS[i % ROW_COLORS.length],
    }));

  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <p className="mb-1 text-xs font-medium tracking-widest uppercase text-text-muted">
        Cost Breakdown
      </p>
      <p className="mb-4 font-[family-name:var(--font-headline)] text-base font-semibold text-text">
        By service · this week
      </p>

      <div>
        {rows.map((row, i) => (
          <div
            key={row.label}
            className="grid items-center gap-3 py-2.5"
            style={{
              gridTemplateColumns: "1fr 56px 84px",
              borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : undefined,
            }}
          >
            <div>
              <p className="text-[13px] font-medium text-text">{row.label}</p>
              <div
                className="glass-track mt-1.5 h-1 rounded-full overflow-hidden"
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${row.pct}%`,
                    background: row.color,
                  }}
                />
              </div>
            </div>
            <p className="font-mono text-xs text-text text-right">{row.pct}%</p>
            <p className="font-mono text-[13px] font-medium text-text text-right">
              ${row.cost.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="py-8 text-center text-sm text-text-muted">No cost data yet</p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm text-text-secondary">Total this week</span>
        <span className="font-[family-name:var(--font-headline)] text-2xl font-bold text-text">
          ${totalCost.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
