"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Cpu, RefreshCw } from "lucide-react";

import { DEMO_MODE, GATEWAY_URL } from "@/lib/config";
import { demoGpuInfo } from "@/lib/demo-data";

interface GpuInfo {
  name: string;
  vram_total_mb: number;
  vram_used_mb: number;
  vram_free_mb: number;
  utilization_percent: number;
  temperature_c: number | null;
  power_draw_w: number | null;
  clock_gpu_mhz: number | null;
  clock_mem_mhz: number | null;
  fan_speed_percent: number | null;
  driver_version: string;
  cuda_version: string;
}

interface GpuResponse {
  gpus: GpuInfo[];
}

const GPU_REFRESH_INTERVAL = 1_000;

function GaugeRing({
  percent,
  size = 120,
  strokeWidth = 10,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
}): React.ReactElement {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  const color =
    percent > 90
      ? "stroke-danger"
      : percent > 70
        ? "stroke-warning"
        : "stroke-success";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-700", color)}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-2xl font-bold text-text">
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}

function GpuCard({ gpu }: { gpu: GpuInfo }): React.ReactElement {
  const vramPercent =
    gpu.vram_total_mb > 0
      ? (gpu.vram_used_mb / gpu.vram_total_mb) * 100
      : 0;

  return (
    <div className="rounded-lg border border-border p-5">
      <div className="mb-4 flex items-center gap-2">
        <Cpu className="h-4 w-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text truncate">{gpu.name}</h3>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex-shrink-0">
          <GaugeRing percent={vramPercent} size={100} strokeWidth={8} />
        </div>

        <div className="w-full space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">VRAM Used</span>
            <span className="font-medium text-text">
              {Math.round(gpu.vram_used_mb)} / {Math.round(gpu.vram_total_mb)} MB
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">GPU Utilization</span>
            <span className="font-medium text-text">
              {gpu.utilization_percent}%
            </span>
          </div>
          {gpu.temperature_c !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Temperature</span>
              <span
                className={cn(
                  "font-medium",
                  gpu.temperature_c > 85
                    ? "text-danger-light"
                    : gpu.temperature_c > 70
                      ? "text-warning-light"
                      : "text-text"
                )}
              >
                {gpu.temperature_c}°C
              </span>
            </div>
          )}
          {gpu.power_draw_w !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Power Draw</span>
              <span className="font-medium text-text">{gpu.power_draw_w} W</span>
            </div>
          )}
          {gpu.clock_gpu_mhz !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">GPU Clock</span>
              <span className="font-medium text-text">{gpu.clock_gpu_mhz} MHz</span>
            </div>
          )}
          {gpu.clock_mem_mhz !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Memory Clock</span>
              <span className="font-medium text-text">{gpu.clock_mem_mhz} MHz</span>
            </div>
          )}
          {gpu.fan_speed_percent !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Fan Speed</span>
              <span className="font-medium text-text">{gpu.fan_speed_percent}%</span>
            </div>
          )}
          {gpu.driver_version && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Driver</span>
              <span className="font-medium text-text">{gpu.driver_version}</span>
            </div>
          )}
          {gpu.cuda_version && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">CUDA</span>
              <span className="font-medium text-text">{gpu.cuda_version}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GpuGauge(): React.ReactElement {
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noGpu, setNoGpu] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const lastRefreshRef = useRef<Date>(new Date());

  const fetchGpuInfo = useCallback(async (): Promise<void> => {
    if (DEMO_MODE) {
      setGpus(demoGpuInfo);
      setError(null);
      setNoGpu(false);
      setLoading(false);
      lastRefreshRef.current = new Date();
      setSecondsAgo(0);
      return;
    }
    try {
      const response = await fetch(`${GATEWAY_URL}/api/v1/system/gpu`, {
        cache: "no-store",
      });
      if (response.ok) {
        const data = (await response.json()) as GpuResponse;
        setGpus(data.gpus ?? []);
        setError(null);
        setNoGpu(false);
      } else if (response.status === 503) {
        // nvidia-smi not available — no GPU on this host
        setGpus([]);
        setError(null);
        setNoGpu(true);
      } else {
        console.error(`GPU endpoint returned ${response.status}`);
        setError("GPU info unavailable");
        setNoGpu(false);
      }
    } catch (err) {
      console.error("Failed to fetch GPU info:", err);
      setError("Failed to fetch GPU info");
      setNoGpu(false);
    } finally {
      setLoading(false);
      lastRefreshRef.current = new Date();
      setSecondsAgo(0);
    }
  }, []);

  useEffect(() => {
    fetchGpuInfo();
    const interval = setInterval(fetchGpuInfo, GPU_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchGpuInfo]);

  // Tick the "Xs ago" counter every second
  useEffect(() => {
    const ticker = setInterval(() => {
      const diff = Math.floor((Date.now() - lastRefreshRef.current.getTime()) / 1000);
      setSecondsAgo(diff);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
            <Cpu className="h-5 w-5" />
            GPU Status
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
            onClick={fetchGpuInfo}
            className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface-hover hover:text-text-secondary"
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center py-6 text-center">
          <Cpu className="mb-2 h-10 w-10 text-text-dim" />
          <p className="text-sm text-text-muted">{error}</p>
          <p className="mt-1 text-xs text-text-dim">
            GPU monitoring requires a CUDA-capable device.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-text-dim" />
        </div>
      ) : noGpu ? (
        <div className="flex flex-col items-center py-6 text-center">
          <Cpu className="mb-2 h-10 w-10 text-text-dim" />
          <p className="text-sm font-medium text-text-muted">No GPU detected</p>
          <p className="mt-1 text-xs text-text-dim">
            No CUDA-capable GPU found on this host. GPU metrics will appear here when a supported device is available.
          </p>
        </div>
      ) : gpus.length > 0 ? (
        <div className={cn(
          "grid gap-4",
          gpus.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
        )}>
          {gpus.map((gpu, i) => (
            <GpuCard key={`${gpu.name}-${i}`} gpu={gpu} />
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xs text-text-dim">
        Auto-refreshes every 1 second
      </p>
    </div>
  );
}
