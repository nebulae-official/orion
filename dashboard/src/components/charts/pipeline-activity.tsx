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
import { tooltipStyle, axisTick, axisStroke, gridStroke, gridDash } from "@/lib/chart-theme";

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
        <CartesianGrid strokeDasharray={gridDash} stroke={gridStroke} />
        <XAxis
          dataKey="day"
          stroke={axisStroke}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke={axisStroke}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip contentStyle={tooltipStyle} />
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
