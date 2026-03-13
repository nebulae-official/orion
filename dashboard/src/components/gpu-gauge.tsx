"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Cpu, RefreshCw } from "lucide-react";

interface GpuInfo {
  name: string;
  vram_total_mb: number;
  vram_used_mb: number;
  vram_free_mb: number;
  utilization_percent: number;
  temperature_c: number | null;
}

import { GATEWAY_URL } from "@/lib/config";
const REFRESH_INTERVAL = 30_000;

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

export function GpuGauge(): React.ReactElement {
  const [gpu, setGpu] = useState<GpuInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGpuInfo = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${GATEWAY_URL}/api/v1/system/gpu`, {
        cache: "no-store",
      });
      if (response.ok) {
        const data = (await response.json()) as GpuInfo;
        setGpu(data);
        setError(null);
      } else {
        setError("GPU info unavailable");
      }
    } catch {
      setError("Failed to fetch GPU info");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGpuInfo();
    const interval = setInterval(fetchGpuInfo, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchGpuInfo]);

  const vramPercent =
    gpu && gpu.vram_total_mb > 0
      ? (gpu.vram_used_mb / gpu.vram_total_mb) * 100
      : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
          <Cpu className="h-5 w-5" />
          GPU Status
        </h2>
        <button
          onClick={fetchGpuInfo}
          className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface-hover hover:text-text-secondary"
          title="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
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
      ) : gpu ? (
        <div className="flex flex-col items-center space-y-4">
          <GaugeRing percent={vramPercent} />

          <div className="w-full space-y-2">
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
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Device</span>
              <span className="truncate pl-2 font-medium text-text">
                {gpu.name}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-text-dim">
        Auto-refreshes every 30 seconds
      </p>
    </div>
  );
}
