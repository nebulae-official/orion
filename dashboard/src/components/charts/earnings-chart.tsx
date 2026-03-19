"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface PlatformEarnings {
  platform: string;
  earnings: number;
}

interface EarningsChartProps {
  data: PlatformEarnings[];
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "#FF0000",
  tiktok: "#00F2EA",
  instagram: "#E1306C",
  twitter: "#1DA1F2",
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "Twitter",
};

export function EarningsChart({ data }: EarningsChartProps): React.ReactElement {
  const chartData = data.map((item) => ({
    name: PLATFORM_LABELS[item.platform] ?? item.platform,
    earnings: item.earnings,
    platform: item.platform,
  }));

  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <h3 className="mb-4 text-lg font-semibold text-text">
        Earnings by Platform
      </h3>
      {chartData.length === 0 ? (
        <p className="py-12 text-center text-text-muted">No earnings data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" stroke="var(--color-text-dim)" tick={{ fill: "var(--color-text-muted)" }} />
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
            <Bar dataKey="earnings" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.platform}
                  fill={PLATFORM_COLORS[entry.platform] ?? "var(--color-text-muted)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
