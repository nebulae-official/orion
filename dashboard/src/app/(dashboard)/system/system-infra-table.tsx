"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { fetchSystemStatus } from "@/lib/actions";

type InfraStatus = "healthy" | "degraded" | "unknown";

interface InfraItem {
  name: string;
  usagePct: number;
  usageLabel: string;
  fillClass: string;
  glowClass: string;
  status: InfraStatus;
}

const DEMO_ITEMS: InfraItem[] = [
  {
    name: "PostgreSQL",
    usagePct: 42,
    usageLabel: "42% disk",
    fillClass: "bg-primary",
    glowClass: "glass-fill-primary",
    status: "healthy",
  },
  {
    name: "Redis",
    usagePct: 18,
    usageLabel: "18% mem",
    fillClass: "bg-danger",
    glowClass: "glass-fill-danger",
    status: "healthy",
  },
  {
    name: "Milvus",
    usagePct: 31,
    usageLabel: "31% vecs",
    fillClass: "bg-cyan",
    glowClass: "glass-fill-cyan",
    status: "healthy",
  },
];

const STATUS_BADGE: Record<InfraStatus, string> = {
  healthy: "bg-success-surface text-success-light",
  degraded: "bg-danger-surface text-danger-light",
  unknown: "bg-surface-elevated text-text-muted",
};

const STATUS_LABEL: Record<InfraStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  unknown: "Unknown",
};

const REFRESH_INTERVAL = 5_000;

export function SystemInfraTable(): React.ReactElement {
  const [items, setItems] = useState<InfraItem[]>(DEMO_ITEMS);

  const refresh = useCallback(async (): Promise<void> => {
    const result = await fetchSystemStatus();

    if (result.authFailed || !result.data?.services) return;

    const services = result.data.services;
    const postgresOk = services.every((s) => s.checks?.postgres !== false);
    const redisOk = services.every((s) => s.checks?.redis !== false);

    setItems([
      { ...DEMO_ITEMS[0], status: postgresOk ? "healthy" : "degraded" },
      { ...DEMO_ITEMS[1], status: redisOk ? "healthy" : "degraded" },
      DEMO_ITEMS[2], // Milvus: no check API yet
    ]);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="glass-card luminous-border overflow-hidden rounded-xl">
      <div className="border-b border-border px-5 py-4">
        <p className="mb-1 font-[family-name:var(--font-display)] text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
          Infrastructure
        </p>
        <p className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
          Data stores &amp; supporting services
        </p>
      </div>

      <div className="px-5">
        {items.map((item) => (
          <div
            key={item.name}
            className="grid grid-cols-[140px_1fr_80px_80px] items-center gap-3.5 border-b border-border py-3 last:border-none"
          >
            <div className="font-[family-name:var(--font-display)] text-[13px] font-medium text-text">
              {item.name}
            </div>

            <div className="h-1.5 overflow-hidden rounded-full glass-track">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  item.fillClass,
                  item.glowClass,
                )}
                style={{ width: `${item.usagePct}%` }}
              />
            </div>

            <div className="text-right font-mono text-xs text-text-secondary">
              {item.usageLabel}
            </div>

            <div className="text-right">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  STATUS_BADGE[item.status],
                )}
              >
                {STATUS_LABEL[item.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
