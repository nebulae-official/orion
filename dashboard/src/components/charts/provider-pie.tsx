"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { tooltipStyle } from "@/lib/chart-theme";

interface ProviderCostData {
  provider: string;
  total_cost: number;
  by_category: Record<string, number>;
}

interface ProviderPieProps {
  data: ProviderCostData[];
}

const COLORS = [
  "var(--color-primary-light)",
  "var(--color-cyan)",
  "var(--color-success)",
  "var(--color-gold)",
  "var(--color-danger)",
  "var(--color-chart-6)",
];

export function ProviderPie({ data }: ProviderPieProps): React.ReactElement {
  const chartData = data.map((item) => ({
    name: item.provider,
    value: item.total_cost,
  }));

  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <h3 className="mb-4 text-lg font-semibold text-text">
        Provider Usage
      </h3>
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-text-muted">No provider data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              label={({ name }) => name}
              stroke="var(--color-bg)"
              strokeWidth={1}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.88}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => `$${Number(v).toFixed(4)}`}
              contentStyle={tooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
