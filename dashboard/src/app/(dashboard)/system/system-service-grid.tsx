"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { fetchSystemStatus, fetchGatewayHealth } from "@/lib/actions";

type ServiceTone = "healthy" | "busy" | "degraded" | "checking";

interface Metric {
  label: string;
  value: string;
}

interface ServiceDef {
  name: string;
  displayName: string;
  host: string;
  // Returns the two stat tiles for this service; queueSize comes from live data.
  getMetrics: (queueSize: number | null) => [Metric, Metric];
}

const SERVICE_DEFS: ServiceDef[] = [
  {
    name: "gateway",
    displayName: "Gateway",
    host: ":8000 · Go",
    getMetrics: () => [
      { label: "Req/s", value: "142" },
      { label: "P95 Latency", value: "38ms" },
    ],
  },
  {
    name: "scout",
    displayName: "Scout",
    host: ":8001 · Python",
    getMetrics: () => [
      { label: "Trends/hr", value: "101" },
      { label: "Scan Cycle", value: "5min" },
    ],
  },
  {
    name: "director",
    displayName: "Director",
    host: ":8002 · Python",
    getMetrics: () => [
      { label: "Scripts/hr", value: "24" },
      { label: "LLM Model", value: "gpt-4o" },
    ],
  },
  {
    name: "media",
    displayName: "Media",
    host: ":8003 · Python",
    getMetrics: (queueSize) => [
      { label: "Queue", value: queueSize !== null ? String(queueSize) : "—" },
      { label: "Provider", value: "Fal.ai" },
    ],
  },
  {
    name: "editor",
    displayName: "Editor",
    host: ":8004 · Python",
    getMetrics: () => [
      { label: "Videos/hr", value: "18" },
      { label: "TTS", value: "ElevenL." },
    ],
  },
  {
    name: "publisher",
    displayName: "Publisher",
    host: ":8006 · Python",
    getMetrics: () => [
      { label: "Posts/hr", value: "12" },
      { label: "Platforms", value: "3" },
    ],
  },
];

interface CardState {
  name: string;
  tone: ServiceTone;
  badge: string;
  queueSize: number | null;
}

const TONE_BADGE: Record<ServiceTone, string> = {
  healthy: "bg-success-surface text-success-light",
  busy: "bg-warning-surface text-warning-light",
  degraded: "bg-danger-surface text-danger-light",
  checking: "bg-surface-elevated text-text-muted",
};

const REFRESH_INTERVAL = 5_000;

export function SystemServiceGrid(): React.ReactElement {
  const [cards, setCards] = useState<CardState[]>(
    SERVICE_DEFS.map((s) => ({
      name: s.name,
      tone: "checking",
      badge: "Checking",
      queueSize: null,
    })),
  );

  const refresh = useCallback(async (): Promise<void> => {
    const [statusResult, gatewayData] = await Promise.all([
      fetchSystemStatus(),
      fetchGatewayHealth(),
    ]);

    const statusData = statusResult.data;

    setCards(
      SERVICE_DEFS.map((svc) => {
        if (svc.name === "gateway") {
          const ok = gatewayData?.status === "ok";
          return {
            name: svc.name,
            tone: ok ? ("healthy" as const) : ("degraded" as const),
            badge: ok ? "Healthy" : "Unhealthy",
            queueSize: null,
          };
        }

        if (statusResult.authFailed) {
          return { name: svc.name, tone: "checking" as const, badge: "—", queueSize: null };
        }

        const svcData = statusData?.services?.find((s) => s.service === svc.name);
        if (!svcData) {
          return { name: svc.name, tone: "degraded" as const, badge: "Unhealthy", queueSize: null };
        }

        const queueSize = svcData.queue_size ?? null;
        const isOk = svcData.status === "ok";
        const isBusy = isOk && (queueSize ?? 0) > 10;

        return {
          name: svc.name,
          tone: isBusy ? ("busy" as const) : isOk ? ("healthy" as const) : ("degraded" as const),
          badge: isBusy ? "Busy" : isOk ? "Active" : "Unhealthy",
          queueSize,
        };
      }),
    );
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="grid grid-cols-2 gap-3.5">
      {SERVICE_DEFS.map((svc, i) => {
        const card = cards[i];
        const [m1, m2] = svc.getMetrics(card.queueSize);

        return (
          <div key={svc.name} className="glass-card luminous-border rounded-xl px-5 py-[18px]">
            <div className="mb-3.5 flex items-center justify-between">
              <div>
                <div className="font-[family-name:var(--font-display)] text-sm font-semibold text-text">
                  {svc.displayName}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-text-muted">{svc.host}</div>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  TONE_BADGE[card.tone],
                )}
              >
                {card.badge}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[m1, m2].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-border bg-surface-elevated px-3 py-2.5"
                >
                  <div className="font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-text-muted">
                    {m.label}
                  </div>
                  <div className="mt-1 font-mono text-lg font-medium tabular-nums text-text">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
