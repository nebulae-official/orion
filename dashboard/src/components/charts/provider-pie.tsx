"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface ProviderCostData {
  provider: string;
  total_cost: number;
  by_category: Record<string, number>;
}

interface ProviderPieProps {
  data: ProviderCostData[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#6366f1"];

export function ProviderPie({ data }: ProviderPieProps): React.ReactElement {
  const chartData = data.map((item) => ({
    name: item.provider,
    value: item.total_cost,
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">
        Provider Usage
      </h3>
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-gray-400">No provider data yet</p>
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
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `$${Number(v).toFixed(4)}`} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
