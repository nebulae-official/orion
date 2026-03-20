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
import { tooltipStyle, axisTick, axisStroke } from "@/lib/chart-theme";

interface PlatformEarnings {
  platform: string;
  earnings: number;
}

interface EarningsChartProps {
  data: PlatformEarnings[];
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "#E04040",
  tiktok: "#25D0C8",
  instagram: "#D44A7A",
  twitter: "#4A9FE6",
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
            <defs>
              {chartData.map((entry) => {
                const color = PLATFORM_COLORS[entry.platform] ?? "#94A3B8";
                return (
                  <linearGradient key={entry.platform} id={`grad-earn-${entry.platform}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                  </linearGradient>
                );
              })}
            </defs>
            <XAxis dataKey="name" stroke={axisStroke} tick={axisTick} />
            <YAxis tickFormatter={(v: number) => `$${v}`} stroke={axisStroke} tick={axisTick} />
            <Tooltip
              formatter={(v) => `$${Number(v).toFixed(2)}`}
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--color-surface-hover)", opacity: 0.5 }}
            />
            <Bar dataKey="earnings" radius={[6, 6, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.platform}
                  fill={`url(#grad-earn-${entry.platform})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
