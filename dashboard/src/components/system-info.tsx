"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Server, RefreshCw } from "lucide-react";
import { DEMO_MODE, GATEWAY_URL } from "@/lib/config";
import { demoSystemInfo } from "@/lib/demo-data";

interface SystemInfoData {
  hostname: string;
  os: string;
  platform: string;
  architecture: string;
  num_cpu: number;
  go_version: string;
  cpu_usage: number;
  memory_total: number;
  memory_used: number;
  memory_free: number;
  memory_usage: number;
  disk_total: number;
  disk_used: number;
  disk_free: number;
  disk_usage: number;
  uptime: string;
  uptime_seconds: number;
}

const REFRESH_INTERVAL = 5_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function ProgressBar({
  value,
  label,
  detail,
}: {
  value: number;
  label: string;
  detail: string;
}): React.ReactElement {
  const color =
    value > 90
      ? "bg-danger"
      : value > 70
        ? "bg-warning"
        : "bg-success";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-text-muted">{label}</span>
        <span className="font-medium text-text">{detail}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <p className="mt-0.5 text-right text-xs text-text-dim">{value.toFixed(1)}%</p>
    </div>
  );
}

export function SystemInfo(): React.ReactElement {
  const [info, setInfo] = useState<SystemInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const lastRefreshRef = useRef<Date>(new Date());

  const fetchInfo = useCallback(async (retries = 0): Promise<void> => {
    if (DEMO_MODE) {
      setInfo(demoSystemInfo);
      setError(null);
      setLoading(false);
      lastRefreshRef.current = new Date();
      setSecondsAgo(0);
      return;
    }
    const url = `${GATEWAY_URL}/api/v1/system/info`;
    try {
      const response = await fetch(url, {
        cache: "no-store",
      });
      if (response.ok) {
        const data = (await response.json()) as SystemInfoData;
        setInfo(data);
        setError(null);
      } else {
        console.error(`System info endpoint returned ${response.status} from ${url}`);
        if (retries < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          return fetchInfo(retries + 1);
        }
        setError(`Unable to reach gateway at ${url} (HTTP ${response.status})`);
      }
    } catch (err) {
      console.error(`Failed to fetch system info from ${url}:`, err);
      if (retries < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        return fetchInfo(retries + 1);
      }
      setError(`Unable to reach gateway at ${url}`);
    } finally {
      setLoading(false);
      lastRefreshRef.current = new Date();
      setSecondsAgo(0);
    }
  }, []);

  useEffect(() => {
    fetchInfo();
    const interval = setInterval(fetchInfo, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchInfo]);

  // Tick the "Xs ago" counter every second
  useEffect(() => {
    const ticker = setInterval(() => {
      const diff = Math.floor((Date.now() - lastRefreshRef.current.getTime()) / 1000);
      setSecondsAgo(diff);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
            <Server className="h-5 w-5" />
            System Overview
          </h2>
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
            onClick={() => fetchInfo()}
            className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface-hover hover:text-text-secondary"
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <Server className="mb-2 h-10 w-10 text-text-dim" />
          <p className="text-sm text-text-muted">{error}</p>
          <p className="mt-1 text-xs text-text-dim">
            Check that the gateway is running and accessible.
          </p>
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-text-dim" />
        </div>
      ) : info ? (
        <div className="flex flex-1 flex-col gap-6 md:flex-row">
          {/* Host Information */}
          <div className="flex flex-1 flex-col space-y-3">
            <h3 className="text-sm font-semibold text-text-secondary">Host Information</h3>
            <div className="flex flex-1 flex-col justify-between space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Hostname</span>
                <span className="font-medium text-text">{info.hostname}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">OS / Platform</span>
                <span className="font-medium text-text">{info.platform}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Architecture</span>
                <span className="font-medium text-text">{info.architecture}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">CPU Cores</span>
                <span className="font-medium text-text">{info.num_cpu}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Go Version</span>
                <span className="font-medium text-text">{info.go_version}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Uptime</span>
                <span className="font-medium text-text">{info.uptime}</span>
              </div>
            </div>
          </div>

          {/* Resource Usage */}
          <div className="flex flex-1 flex-col space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary">Resource Usage</h3>

            <div className="flex flex-1 flex-col justify-between">
              <ProgressBar
                value={info.cpu_usage}
                label="CPU"
                detail={`${info.num_cpu} cores`}
              />

              <ProgressBar
                value={info.memory_usage}
                label="Memory"
                detail={`${formatBytes(info.memory_used)} / ${formatBytes(info.memory_total)}`}
              />

              <ProgressBar
                value={info.disk_usage}
                label="Disk"
                detail={`${formatBytes(info.disk_used)} / ${formatBytes(info.disk_total)}`}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
