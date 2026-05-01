"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { tooltipStyle, axisTick, axisStroke, gridStroke } from "@/lib/chart-theme";
import type { VolumeDataPoint } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

type Period = "7D" | "30D" | "Q";

interface OutputVelocityChartProps {
  data: VolumeDataPoint[];
}

export function OutputVelocityChart({
  data,
}: OutputVelocityChartProps): React.ReactElement {
  const [period, setPeriod] = useState<Period>("30D");

  const periodSlice: Record<Period, number> = { "7D": 7, "30D": 30, Q: 90 };
  const visible = data.slice(-periodSlice[period]);

  const peakPublished = visible.reduce(
    (max, d) => (d.published > max ? d.published : max),
    0,
  );
  const peakDay = visible.find((d) => d.published === peakPublished);

  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs font-medium tracking-widest uppercase text-text-muted">
            Output Velocity
          </p>
          <p className="font-[family-name:var(--font-headline)] text-base font-semibold text-text">
            Videos published ·{" "}
            {period === "7D" ? "7 days" : period === "30D" ? "30 days" : "quarter"}
          </p>
        </div>
        <div className="flex gap-1">
          {(["7D", "30D", "Q"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium tracking-widest uppercase transition-all",
                period === p
                  ? "bg-primary-surface text-primary-light"
                  : "text-text-muted hover:text-text",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={visible} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="ov-grad-rendered" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ov-grad-published" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            stroke={axisStroke}
            tick={axisTick}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis stroke={axisStroke} tick={axisTick} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey="rendered"
            stroke="#A78BFA"
            strokeWidth={2.5}
            fill="url(#ov-grad-rendered)"
            dot={false}
            name="Rendered"
          />
          <Area
            type="monotone"
            dataKey="published"
            stroke="#22D3EE"
            strokeWidth={2}
            fill="url(#ov-grad-published)"
            dot={false}
            name="Published"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary-light"
            style={{ boxShadow: "0 0 8px #A78BFA" }}
          />
          Rendered
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-cyan"
            style={{ boxShadow: "0 0 8px #22D3EE" }}
          />
          Published
        </div>
        {peakDay && (
          <span className="ml-auto font-mono text-[11px] text-text-muted">
            peak {peakPublished} @ {peakDay.day}
          </span>
        )}
      </div>
    </div>
  );
}
