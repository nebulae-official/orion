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
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="mb-4 text-lg font-semibold text-text">
        Content Pipeline
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <XAxis type="number" stroke="var(--color-text-dim)" tick={{ fill: "var(--color-text-muted)" }} />
          <YAxis type="category" dataKey="stage" width={100} stroke="var(--color-text-dim)" tick={{ fill: "var(--color-text-muted)" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.5rem",
              color: "var(--color-text)",
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.stage} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
