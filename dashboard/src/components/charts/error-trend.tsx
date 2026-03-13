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
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="mb-4 text-lg font-semibold text-text">
        Error Trends (last 7 days)
      </h3>
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-text-muted">No error data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="time" stroke="var(--color-text-dim)" tick={{ fill: "var(--color-text-muted)" }} />
            <YAxis stroke="var(--color-text-dim)" tick={{ fill: "var(--color-text-muted)" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.5rem",
                color: "var(--color-text)",
              }}
            />
            <Line
              type="monotone"
              dataKey="errors"
              stroke="var(--color-danger)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
