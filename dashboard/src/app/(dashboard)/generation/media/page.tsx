import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ImageIcon,
  Cloud,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";
import { serverFetch } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";
import { demoMediaAssets } from "@/lib/demo-data";
import { StatCard } from "@/components/charts/stat-card";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { MediaAsset } from "@/types/api";
import { MediaPoller } from "./media-poller";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderInfo {
  name: string;
  type: "LOCAL" | "CLOUD";
  status: "online" | "offline";
  models: string[];
}

interface BatchJob {
  id: string;
  content_id: string;
  content_title: string;
  provider: string;
  total_images: number;
  completed_images: number;
  status: "running" | "completed" | "queued" | "failed";
  started_at: string;
  completed_at?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

const DEMO_PROVIDERS: ProviderInfo[] = [
  { name: "ComfyUI", type: "LOCAL", status: "online", models: ["SDXL 1.0", "SD 1.5"] },
  { name: "Fal.ai", type: "CLOUD", status: "online", models: ["FLUX.1", "SDXL Lightning"] },
];

const DEMO_BATCHES: BatchJob[] = [
  { id: "batch-001", content_id: "c-003", content_title: "The Apple Vision Pro 2", provider: "ComfyUI", total_images: 4, completed_images: 3, status: "running" as const, started_at: hoursAgo(0.5) },
  { id: "batch-002", content_id: "c-004", content_title: "Open-Source LLMs", provider: "Fal.ai", total_images: 4, completed_images: 4, status: "completed" as const, started_at: hoursAgo(2), completed_at: hoursAgo(1.5) },
  { id: "batch-003", content_id: "c-007", content_title: "The Fed Changed Everything", provider: "ComfyUI", total_images: 3, completed_images: 0, status: "queued" as const, started_at: hoursAgo(0.1) },
  { id: "batch-004", content_id: "c-014", content_title: "Unreal Engine 6 Preview", provider: "Fal.ai", total_images: 4, completed_images: 2, status: "failed" as const, started_at: hoursAgo(4), error: "Provider rate limit exceeded" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

const STATUS_CONFIG = {
  running: { label: "Running", dotClass: "bg-primary-light", badgeClass: "text-primary-light bg-primary-surface", spinning: true },
  completed: { label: "Completed", dotClass: "bg-success-light", badgeClass: "text-success-light bg-success-surface", spinning: false },
  queued: { label: "Queued", dotClass: "bg-warning-light", badgeClass: "text-warning-light bg-warning-surface", spinning: false },
  failed: { label: "Failed", dotClass: "bg-danger-light", badgeClass: "text-danger-light bg-danger-surface", spinning: false },
} as const;

const TYPE_COLORS: Record<string, string> = {
  image: "text-primary-light bg-primary-surface",
  video: "text-success-light bg-success-surface",
  audio: "text-warning-light bg-warning-surface",
};

const GRADIENT_PALETTES = [
  "from-violet-600/40 to-fuchsia-500/40",
  "from-cyan-600/40 to-blue-500/40",
  "from-emerald-600/40 to-teal-500/40",
  "from-amber-600/40 to-orange-500/40",
  "from-rose-600/40 to-pink-500/40",
  "from-indigo-600/40 to-purple-500/40",
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MediaPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token && !DEMO_MODE) {
    redirect("/login");
  }

  let providers: ProviderInfo[] = [];
  let batches: BatchJob[] = [];
  let mediaAssets: MediaAsset[] = [];
  let fetchError = false;

  if (DEMO_MODE) {
    providers = DEMO_PROVIDERS;
    batches = DEMO_BATCHES;
    mediaAssets = demoMediaAssets;
  } else {
    try {
      const [providerRes, batchRes, assetRes] = await Promise.all([
        serverFetch<ProviderInfo[]>("/api/v1/media/providers", {}, token),
        serverFetch<BatchJob[]>("/api/v1/media/batches", {}, token),
        serverFetch<{ items: MediaAsset[] }>("/api/v1/media/assets", {}, token),
      ]);
      providers = providerRes;
      batches = batchRes;
      mediaAssets = assetRes.items;
    } catch {
      fetchError = true;
      providers = DEMO_PROVIDERS;
      batches = DEMO_BATCHES;
      mediaAssets = demoMediaAssets;
    }
  }

  // Compute stats
  const totalImages = mediaAssets.filter((a) => a.type === "image").length;
  const completedBatches = batches.filter((b) => b.status === "completed").length;
  const failedBatches = batches.filter((b) => b.status === "failed").length;
  const activeBatches = batches.filter((b) => b.status === "running" || b.status === "queued").length;
  const successRate = batches.length > 0
    ? Math.round((completedBatches / (completedBatches + failedBatches || 1)) * 100)
    : 100;
  const avgPerContent = mediaAssets.length > 0
    ? (mediaAssets.length / new Set(mediaAssets.map((a) => a.content_id)).size).toFixed(1)
    : "0";

  const hasRunning = batches.some((b) => b.status === "running");

  return (
    <div className="space-y-6">
      {/* Smart polling when batches are active */}
      {hasRunning && <MediaPoller />}

      {fetchError && (
        <div className="rounded-xl border border-warning-surface bg-warning-surface/30 p-4 text-sm text-warning-light">
          Unable to load media data from the gateway. Showing demo results.
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Provider Status Strip                                               */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Media providers">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          Providers
        </h2>
        <div className="flex flex-wrap gap-4">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="glass-card luminous-border flex min-w-[220px] flex-1 items-start gap-4 rounded-xl p-4"
            >
              <div className="mt-0.5 rounded-lg bg-surface-elevated p-2">
                {provider.type === "LOCAL" ? (
                  <Monitor className="h-5 w-5 text-primary-light" />
                ) : (
                  <Cloud className="h-5 w-5 text-primary-light" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text">{provider.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      provider.type === "LOCAL"
                        ? "bg-primary-surface text-primary-light"
                        : "bg-[hsl(270,60%,20%)] text-[hsl(270,80%,75%)]"
                    )}
                  >
                    {provider.type}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {provider.status === "online" ? (
                    <>
                      <Wifi className="h-3.5 w-3.5 text-success-light" />
                      <span className="text-xs text-success-light">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3.5 w-3.5 text-danger-light" />
                      <span className="text-xs text-danger-light">Offline</span>
                    </>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {provider.models.map((model) => (
                    <span
                      key={model}
                      className="rounded bg-surface-elevated px-1.5 py-0.5 text-[11px] text-text-dim"
                    >
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Status Summary Cards                                                */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Media statistics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Images Generated" value={totalImages} subtitle={`${mediaAssets.length} total assets`} />
          <StatCard title="Success Rate" value={`${successRate}%`} subtitle={`${completedBatches} of ${completedBatches + failedBatches} batches`} />
          <StatCard title="Active Batches" value={activeBatches} subtitle={hasRunning ? "Processing now" : "All idle"} />
          <StatCard title="Average per Content" value={avgPerContent} subtitle="Assets per content item" />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Active Batch Progress                                               */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Batch progress">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          Batch Jobs
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {batches.map((batch) => {
            const pct = batch.total_images > 0
              ? Math.round((batch.completed_images / batch.total_images) * 100)
              : 0;
            const cfg = STATUS_CONFIG[batch.status];

            return (
              <div
                key={batch.id}
                className="glass-card luminous-border rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text">
                      {batch.content_title}
                    </p>
                    <p className="mt-0.5 text-xs text-text-dim">
                      {batch.provider} &middot; {batch.content_id}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                      cfg.badgeClass
                    )}
                  >
                    {cfg.spinning ? (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : batch.status === "completed" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : batch.status === "failed" ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {cfg.label}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-text-secondary">
                      {batch.completed_images} of {batch.total_images} images
                    </span>
                    <span className="text-text-muted">{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full glass-track">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        batch.status === "failed" ? "bg-danger-light" : "bg-primary"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Error message */}
                {batch.error && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-danger-light">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {batch.error}
                  </p>
                )}

                {/* Timing */}
                <p className="mt-2 text-xs text-text-dim">
                  Started {formatRelativeTime(batch.started_at)}
                  {batch.completed_at && ` \u00B7 Finished ${formatRelativeTime(batch.completed_at)}`}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Image Grid                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Generated media assets">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          Generated Assets
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {mediaAssets.map((asset, idx) => (
            <div
              key={asset.id}
              className="glass-card luminous-border overflow-hidden rounded-xl"
            >
              {/* Placeholder thumbnail */}
              <div
                className={cn(
                  "flex h-32 items-center justify-center bg-gradient-to-br",
                  GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length]
                )}
              >
                <ImageIcon className="h-8 w-8 text-white/50" />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-text-secondary">
                    {asset.content_id}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase",
                      TYPE_COLORS[asset.type] ?? "text-text-dim bg-surface-elevated"
                    )}
                  >
                    {asset.type}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-dim">
                  <span>{asset.file_size ? formatFileSize(asset.file_size) : "N/A"}</span>
                  <span>{formatRelativeTime(asset.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
