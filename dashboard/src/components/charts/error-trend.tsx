"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { tooltipStyle, axisTick, axisStroke, gridStroke, gridDash } from "@/lib/chart-theme";

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
    <div className="glass-card luminous-border rounded-xl p-6">
      <h3 className="mb-4 text-lg font-semibold text-text">
        Error Trends (last 7 days)
      </h3>
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-text-muted">No error data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gradErrors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-danger)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-danger)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray={gridDash} stroke={gridStroke} />
            <XAxis dataKey="time" stroke={axisStroke} tick={axisTick} />
            <YAxis stroke={axisStroke} tick={axisTick} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="errors"
              stroke="var(--color-danger)"
              strokeWidth={2}
              fill="url(#gradErrors)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
