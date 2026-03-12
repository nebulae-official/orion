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
  llm_tokens: "#3b82f6",
  image_generation: "#10b981",
  tts_characters: "#f59e0b",
  video_clips: "#8b5cf6",
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
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">
        Cost by Provider
      </h3>
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-gray-400">No cost data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
            <Tooltip formatter={(v) => `$${Number(v).toFixed(4)}`} />
            <Legend />
            {Array.from(categories).map((cat) => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="cost"
                fill={CATEGORY_COLORS[cat] ?? "#9ca3af"}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
