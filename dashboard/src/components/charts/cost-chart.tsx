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
import { tooltipStyle, axisTick, axisStroke } from "@/lib/chart-theme";

interface ProviderCostData {
  provider: string;
  total_cost: number;
  by_category: Record<string, number>;
}

interface CostChartProps {
  data: ProviderCostData[];
}

const CATEGORY_COLORS: Record<string, string> = {
  inference: "var(--color-primary-light)",
  image_generation: "var(--color-success)",
  tts: "var(--color-gold)",
  video_generation: "var(--color-cyan)",
  embedding: "var(--color-chart-6)",
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
    <div className="glass-card luminous-border rounded-xl p-6">
      <h3 className="mb-4 text-lg font-semibold text-text">
        Cost by Provider
      </h3>
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-text-muted">No cost data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" stroke={axisStroke} tick={axisTick} />
            <YAxis tickFormatter={(v: number) => `$${v.toFixed(2)}`} stroke={axisStroke} tick={axisTick} />
            <Tooltip
              formatter={(v) => `$${Number(v).toFixed(4)}`}
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--color-surface-hover)", opacity: 0.5 }}
            />
            <Legend wrapperStyle={{ color: "var(--color-text-secondary)" }} />
            {Array.from(categories).map((cat) => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="cost"
                fill={CATEGORY_COLORS[cat] ?? "var(--color-text-muted)"}
                fillOpacity={0.85}
                radius={cat === Array.from(categories).at(-1) ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
