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

interface FunnelData {
  stage: string;
  count: number;
  color: string;
}

interface FunnelChartProps {
  data: FunnelData[];
}

export function FunnelChart({ data }: FunnelChartProps): React.ReactElement {
  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <h3 className="mb-4 text-lg font-semibold text-text">
        Content Pipeline
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <defs>
            {data.map((entry) => (
              <linearGradient key={entry.stage} id={`grad-${entry.stage}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={entry.color} stopOpacity={0.6} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.9} />
              </linearGradient>
            ))}
          </defs>
          <XAxis type="number" stroke={axisStroke} tick={axisTick} />
          <YAxis type="category" dataKey="stage" width={100} stroke={axisStroke} tick={axisTick} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-surface-hover)", opacity: 0.5 }} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
            {data.map((entry) => (
              <Cell key={entry.stage} fill={`url(#grad-${entry.stage})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
