"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ProviderCostData {
  provider: string;
  total_cost: number;
  by_category: Record<string, number>;
}

interface CostChartProps {
  data: ProviderCostData[];
}

const CATEGORY_COLORS: Record<string, string> = {
  llm_tokens: "var(--color-primary-light)",
  image_generation: "var(--color-success)",
  tts_characters: "var(--color-gold)",
  video_clips: "var(--color-cyan)",
};

export function CostChart({ data }: CostChartProps): React.ReactElement {
  const categories = new Set<string>();
  for (const item of data) {
    for (const cat of Object.keys(item.by_category)) {
      categories.add(cat);
    }
  }

  const chartData = data.map((item) => ({
    name: item.provider,
    ...item.by_category,
  }));

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="mb-4 text-lg font-semibold text-text">
        Cost by Provider
      </h3>
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-text-muted">No cost data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" stroke="var(--color-text-dim)" tick={{ fill: "var(--color-text-muted)" }} />
            <YAxis tickFormatter={(v: number) => `$${v.toFixed(2)}`} stroke="var(--color-text-dim)" tick={{ fill: "var(--color-text-muted)" }} />
            <Tooltip
              formatter={(v) => `$${Number(v).toFixed(4)}`}
              contentStyle={{
                backgroundColor: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.5rem",
                color: "var(--color-text)",
              }}
            />
            <Legend wrapperStyle={{ color: "var(--color-text-secondary)" }} />
            {Array.from(categories).map((cat) => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="cost"
                fill={CATEGORY_COLORS[cat] ?? "var(--color-text-muted)"}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
