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
import { Activity } from "lucide-react";

export interface PipelineActivityData {
  day: string;
  trends: number;
  generated: number;
  published: number;
}

interface PipelineActivityProps {
  data: PipelineActivityData[];
}

export function PipelineActivity({
  data,
}: PipelineActivityProps): React.ReactElement {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[250px] text-center">
        <Activity className="h-10 w-10 text-on-surface-variant/40 mb-3" />
        <p className="text-sm text-on-surface-variant">
          Pipeline activity will appear as content is generated
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gradTrends" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradGenerated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradPublished" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-3)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-chart-3)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="day"
          stroke="rgba(255,255,255,0.15)"
          tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="rgba(255,255,255,0.15)"
          tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(15, 15, 20, 0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "0.5rem",
            color: "rgba(255,255,255,0.9)",
            fontSize: "0.8rem",
          }}
        />
        <Area
          type="monotone"
          dataKey="trends"
          name="Trends Detected"
          stroke="var(--color-chart-2)"
          strokeWidth={2}
          fill="url(#gradTrends)"
        />
        <Area
          type="monotone"
          dataKey="generated"
          name="Content Generated"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="url(#gradGenerated)"
        />
        <Area
          type="monotone"
          dataKey="published"
          name="Published"
          stroke="var(--color-chart-3)"
          strokeWidth={2}
          fill="url(#gradPublished)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
