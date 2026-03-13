"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { fetchSystemStatus, fetchGatewayHealth } from "@/lib/actions";

interface ServiceStatus {
  name: string;
  displayName: string;
  status: "healthy" | "unhealthy" | "checking";
  uptime: string | null;
  queueSize: number | null;
  lastChecked: string | null;
}

const SERVICES: { name: string; displayName: string }[] = [
  { name: "gateway", displayName: "Gateway" },
  { name: "scout", displayName: "Scout (Trends)" },
  { name: "director", displayName: "Director (Scripts)" },
  { name: "media", displayName: "Media (Assets)" },
  { name: "editor", displayName: "Editor (Publish)" },
  { name: "pulse", displayName: "Pulse (Analytics)" },
];

const REFRESH_INTERVAL = 30_000;

export function ServiceHealth(): React.ReactElement {
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES.map((s) => ({
      name: s.name,
      displayName: s.displayName,
      status: "checking",
      uptime: null,
      queueSize: null,
      lastChecked: null,
    }))
  );
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const checkServices = useCallback(async (): Promise<void> => {
    setRefreshing(true);

    // Check gateway health + aggregated status via server actions
    const [statusData, gatewayData] = await Promise.all([
      fetchSystemStatus(),
      fetchGatewayHealth(),
    ]);

    const updated = SERVICES.map((svc) => {
      if (svc.name === "gateway") {
        return {
          name: svc.name,
          displayName: svc.displayName,
          status: gatewayData?.status === "ok" ? ("healthy" as const) : ("unhealthy" as const),
          uptime: null,
          queueSize: null,
          lastChecked: new Date().toISOString(),
        };
      }

      const svcData = statusData?.services?.find((s) => s.service === svc.name);
      if (svcData) {
        return {
          name: svc.name,
          displayName: svc.displayName,
          status: svcData.status === "ok" ? ("healthy" as const) : ("unhealthy" as const),
          uptime: null,
          queueSize: null,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        name: svc.name,
        displayName: svc.displayName,
        status: "unhealthy" as const,
        uptime: null,
        queueSize: null,
        lastChecked: new Date().toISOString(),
      };
    });

    setServices(updated);
    setLastRefresh(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [checkServices]);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Service Status</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-dim">
            Updated {formatRelativeTime(lastRefresh)}
          </span>
          <button
            onClick={checkServices}
            disabled={refreshing}
            className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface-hover hover:text-text-secondary"
            title="Refresh now"
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {services.map((svc) => (
          <div
            key={svc.name}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-block h-3 w-3 rounded-full",
                  svc.status === "healthy" && "bg-success",
                  svc.status === "unhealthy" && "bg-danger",
                  svc.status === "checking" && "animate-pulse bg-warning"
                )}
              />
              <div>
                <p className="text-sm font-medium text-text">
                  {svc.displayName}
                </p>
                {svc.uptime && (
                  <p className="text-xs text-text-dim">Uptime: {svc.uptime}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {svc.queueSize !== null && (
                <div className="text-right">
                  <p className="text-xs text-text-dim">Queue</p>
                  <p className="text-sm font-medium text-text-secondary">
                    {svc.queueSize}
                  </p>
                </div>
              )}
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  svc.status === "healthy" &&
                    "bg-success-surface text-success-light",
                  svc.status === "unhealthy" &&
                    "bg-danger-surface text-danger-light",
                  svc.status === "checking" &&
                    "bg-warning-surface text-warning-light"
                )}
              >
                {svc.status === "checking"
                  ? "Checking"
                  : svc.status === "healthy"
                    ? "Healthy"
                    : "Unhealthy"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-text-dim">
        Auto-refreshes every 30 seconds
      </p>
    </div>
  );
}
