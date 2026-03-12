"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface ErrorTrendData {
  timestamp: string;
  error_count: number;
  total_count: number;
  error_rate: number;
}

interface ErrorTrendProps {
  data: ErrorTrendData[];
}

export function ErrorTrend({ data }: ErrorTrendProps): React.ReactElement {
  const chartData = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    errors: d.error_count,
    rate: +(d.error_rate * 100).toFixed(1),
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">
        Error Trends (last 7 days)
      </h3>
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-gray-400">No error data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="errors"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
