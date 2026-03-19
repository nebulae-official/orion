"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { fetchSystemStatus, fetchGatewayHealth } from "@/lib/actions";

interface DependencyChecks {
  redis: boolean;
  postgres: boolean;
}

interface ServiceStatus {
  name: string;
  displayName: string;
  status: "healthy" | "unhealthy" | "checking" | "auth_required";
  uptime: string | null;
  queueSize: number | null;
  lastChecked: string | null;
  checks: DependencyChecks | null;
}

const SERVICES: { name: string; displayName: string }[] = [
  { name: "gateway", displayName: "Gateway" },
  { name: "scout", displayName: "Scout (Trends)" },
  { name: "director", displayName: "Director (Scripts)" },
  { name: "media", displayName: "Media (Assets)" },
  { name: "editor", displayName: "Editor (Video)" },
  { name: "pulse", displayName: "Pulse (Analytics)" },
  { name: "publisher", displayName: "Publisher (Social)" },
];

const REFRESH_INTERVAL = 5_000;

export function ServiceHealth(): React.ReactElement {
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES.map((s) => ({
      name: s.name,
      displayName: s.displayName,
      status: "checking",
      uptime: null,
      queueSize: null,
      lastChecked: null,
      checks: null,
    }))
  );
  const [, setLastRefresh] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const lastRefreshRef = useRef<Date>(new Date());

  const checkServices = useCallback(async (): Promise<void> => {
    setRefreshing(true);

    const [statusResult, gatewayData] = await Promise.all([
      fetchSystemStatus(),
      fetchGatewayHealth(),
    ]);

    const statusData = statusResult.data;
    const authFailed = statusResult.authFailed;
    setAuthRequired(authFailed);

    const updated = SERVICES.map((svc) => {
      if (svc.name === "gateway") {
        return {
          name: svc.name,
          displayName: svc.displayName,
          status: gatewayData?.status === "ok" ? ("healthy" as const) : ("unhealthy" as const),
          uptime: null,
          queueSize: null,
          lastChecked: new Date().toISOString(),
          checks: null,
        };
      }

      // If auth failed, show auth_required instead of unhealthy
      if (authFailed) {
        return {
          name: svc.name,
          displayName: svc.displayName,
          status: "auth_required" as const,
          uptime: null,
          queueSize: null,
          lastChecked: new Date().toISOString(),
          checks: null,
        };
      }

      const svcData = statusData?.services?.find((s) => s.service === svc.name);
      if (svcData) {
        return {
          name: svc.name,
          displayName: svc.displayName,
          status: svcData.status === "ok" ? ("healthy" as const) : ("unhealthy" as const),
          uptime: svcData.uptime ?? null,
          queueSize: svcData.queue_size ?? null,
          lastChecked: new Date().toISOString(),
          checks: svcData.checks ?? null,
        };
      }

      return {
        name: svc.name,
        displayName: svc.displayName,
        status: "unhealthy" as const,
        uptime: null,
        queueSize: null,
        lastChecked: new Date().toISOString(),
        checks: null,
      };
    });

    setServices(updated);
    const now = new Date();
    setLastRefresh(now);
    lastRefreshRef.current = now;
    setSecondsAgo(0);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [checkServices]);

  // Tick the "Xs ago" counter every second
  useEffect(() => {
    const ticker = setInterval(() => {
      const diff = Math.floor((Date.now() - lastRefreshRef.current.getTime()) / 1000);
      setSecondsAgo(diff);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text">Service Status</h2>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-xs font-medium text-success">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-dim">
            Updated {secondsAgo}s ago
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
                  svc.status === "checking" && "animate-pulse bg-warning",
                  svc.status === "auth_required" && "bg-text-dim"
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
                    "bg-warning-surface text-warning-light",
                  svc.status === "auth_required" &&
                    "bg-surface-elevated text-text-dim"
                )}
              >
                {svc.status === "checking"
                  ? "Checking"
                  : svc.status === "healthy"
                    ? "Healthy"
                    : svc.status === "auth_required"
                      ? "Auth Required"
                      : "Unhealthy"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {authRequired && (
        <p className="mt-4 text-xs text-text-muted">
          Sign in for full service status
        </p>
      )}

      <p className="mt-4 text-xs text-text-dim">
        Auto-refreshes every 5 seconds
      </p>
    </div>
  );
}

/** InfrastructureStatus shows Redis/Postgres connectivity per service. */
export function InfrastructureStatus(): React.ReactElement {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [authFailed, setAuthFailed] = useState(false);

  const fetchStatus = useCallback(async (): Promise<void> => {
    const statusResult = await fetchSystemStatus();
    const statusData = statusResult.data;
    setAuthFailed(statusResult.authFailed);
    if (!statusData?.services) return;

    const updated = statusData.services.map((svcData) => ({
      name: svcData.service,
      displayName: svcData.service.charAt(0).toUpperCase() + svcData.service.slice(1),
      status: svcData.status === "ok" ? ("healthy" as const) : ("unhealthy" as const),
      uptime: svcData.uptime ?? null,
      queueSize: svcData.queue_size ?? null,
      lastChecked: new Date().toISOString(),
      checks: svcData.checks ?? null,
    }));

    setServices(updated);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Aggregate infrastructure status
  const redisOk = services.length > 0 && services.every((s) => s.checks?.redis !== false);
  const postgresOk = services.length > 0 && services.every((s) => s.checks?.postgres !== false);

  const infraStatus = (ok: boolean): { label: string; dotClass: string; badgeClass: string } => {
    if (authFailed) {
      return {
        label: "Unknown — sign in for status",
        dotClass: "bg-text-dim",
        badgeClass: "bg-surface-elevated text-text-dim",
      };
    }
    return ok
      ? { label: "Connected", dotClass: "bg-success", badgeClass: "bg-success-surface text-success-light" }
      : { label: "Disconnected", dotClass: "bg-danger", badgeClass: "bg-danger-surface text-danger-light" };
  };

  const redisStatus = infraStatus(redisOk);
  const pgStatus = infraStatus(postgresOk);

  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <h2 className="mb-4 text-lg font-semibold text-text">Infrastructure</h2>

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-full",
                redisStatus.dotClass
              )}
            />
            <span className="text-sm font-medium text-text">Redis</span>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              redisStatus.badgeClass
            )}
          >
            {redisStatus.label}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-full",
                pgStatus.dotClass
              )}
            />
            <span className="text-sm font-medium text-text">PostgreSQL</span>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              pgStatus.badgeClass
            )}
          >
            {pgStatus.label}
          </span>
        </div>

        {/* Per-service dependency breakdown */}
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-text-muted">Per-service checks</p>
          {services
            .filter((s) => s.checks !== null)
            .map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between text-xs text-text-dim"
              >
                <span className="capitalize">{svc.name}</span>
                <div className="flex items-center gap-2">
                  <span className={cn(svc.checks?.redis ? "text-success" : "text-danger")}>
                    Redis
                  </span>
                  <span className={cn(svc.checks?.postgres ? "text-success" : "text-danger")}>
                    Postgres
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
