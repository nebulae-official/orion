"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface EarningsTrendData {
  date: string;
  earnings: number;
}

interface EarningsTrendProps {
  data: EarningsTrendData[];
}

export function EarningsTrend({ data }: EarningsTrendProps): React.ReactElement {
  const chartData = data.map((item) => ({
    date: item.date.slice(5), // "03-01" format
    earnings: item.earnings,
  }));

  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <h3 className="mb-4 text-lg font-semibold text-text">
        Earnings Trend
      </h3>
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-text-muted">No trend data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary-light)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-primary-light)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" stroke="var(--color-text-dim)" tick={{ fill: "var(--color-text-muted)" }} />
            <YAxis tickFormatter={(v: number) => `$${v}`} stroke="var(--color-text-dim)" tick={{ fill: "var(--color-text-muted)" }} />
            <Tooltip
              formatter={(v) => `$${Number(v).toFixed(2)}`}
              contentStyle={{
                backgroundColor: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.5rem",
                color: "var(--color-text)",
              }}
            />
            <Area
              type="monotone"
              dataKey="earnings"
              stroke="var(--color-primary-light)"
              fill="url(#earningsGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
