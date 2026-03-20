import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverFetch } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";
import { StatCard } from "@/components/charts/stat-card";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import {
  Film,
  Mic,
  Captions,
  Scissors,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { VideoPoller } from "./video-poller";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface RenderStage {
  name: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  duration_seconds: number | null;
}

interface RenderJob {
  id: string;
  content_id: string;
  content_title: string;
  status: "queued" | "rendering" | "completed" | "failed";
  stages: RenderStage[];
  total_duration_seconds: number | null;
  output_format: string;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

// -----------------------------------------------------------------------
// Demo data
// -----------------------------------------------------------------------

function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

const DEMO_RENDERS: RenderJob[] = [
  {
    id: "render-001",
    content_id: "c-012",
    content_title: "Indie Games Are Dominating Steam",
    status: "completed",
    output_format: "mp4",
    stages: [
      { name: "tts", label: "TTS", status: "completed", duration_seconds: 45 },
      { name: "captions", label: "Captions", status: "completed", duration_seconds: 12 },
      { name: "stitching", label: "Stitching", status: "completed", duration_seconds: 89 },
    ],
    total_duration_seconds: 146,
    started_at: hoursAgo(48),
    completed_at: hoursAgo(47.5),
    error: null,
  },
  {
    id: "render-002",
    content_id: "c-013",
    content_title: "Kubernetes Without Docker",
    status: "completed",
    output_format: "mp4",
    stages: [
      { name: "tts", label: "TTS", status: "completed", duration_seconds: 38 },
      { name: "captions", label: "Captions", status: "completed", duration_seconds: 10 },
      { name: "stitching", label: "Stitching", status: "completed", duration_seconds: 72 },
    ],
    total_duration_seconds: 120,
    started_at: hoursAgo(60),
    completed_at: hoursAgo(59),
    error: null,
  },
  {
    id: "render-003",
    content_id: "c-003",
    content_title: "The Apple Vision Pro 2",
    status: "rendering",
    output_format: "mp4",
    stages: [
      { name: "tts", label: "TTS", status: "completed", duration_seconds: 42 },
      { name: "captions", label: "Captions", status: "running", duration_seconds: null },
      { name: "stitching", label: "Stitching", status: "pending", duration_seconds: null },
    ],
    total_duration_seconds: null,
    started_at: minutesAgo(8),
    completed_at: null,
    error: null,
  },
  {
    id: "render-004",
    content_id: "c-005",
    content_title: "GTA VI: Why This Trailer Broke the Internet",
    status: "completed",
    output_format: "mp4",
    stages: [
      { name: "tts", label: "TTS", status: "completed", duration_seconds: 55 },
      { name: "captions", label: "Captions", status: "completed", duration_seconds: 15 },
      { name: "stitching", label: "Stitching", status: "completed", duration_seconds: 110 },
    ],
    total_duration_seconds: 180,
    started_at: hoursAgo(24),
    completed_at: hoursAgo(23.5),
    error: null,
  },
  {
    id: "render-005",
    content_id: "c-014",
    content_title: "Unreal Engine 6 Preview",
    status: "failed",
    output_format: "mp4",
    stages: [
      { name: "tts", label: "TTS", status: "completed", duration_seconds: 40 },
      { name: "captions", label: "Captions", status: "completed", duration_seconds: 11 },
      { name: "stitching", label: "Stitching", status: "failed", duration_seconds: null },
    ],
    total_duration_seconds: null,
    started_at: hoursAgo(36),
    completed_at: hoursAgo(35.5),
    error: "FFmpeg stitching failed: missing audio track",
  },
  {
    id: "render-006",
    content_id: "c-004",
    content_title: "Open-Source LLMs Are Catching Up",
    status: "queued",
    output_format: "mp4",
    stages: [
      { name: "tts", label: "TTS", status: "pending", duration_seconds: null },
      { name: "captions", label: "Captions", status: "pending", duration_seconds: null },
      { name: "stitching", label: "Stitching", status: "pending", duration_seconds: null },
    ],
    total_duration_seconds: null,
    started_at: minutesAgo(2),
    completed_at: null,
    error: null,
  },
];

// -----------------------------------------------------------------------
// Render stage definitions for the step tracker
// -----------------------------------------------------------------------

const RENDER_STAGES = [
  { key: "tts", label: "TTS", icon: Mic },
  { key: "captions", label: "Captions", icon: Captions },
  { key: "stitching", label: "Stitching", icon: Scissors },
] as const;

// -----------------------------------------------------------------------
// Status badge styles
// -----------------------------------------------------------------------

const STATUS_BADGE: Record<
  RenderJob["status"],
  { label: string; className: string }
> = {
  completed: {
    label: "Completed",
    className: "bg-success-surface text-success-light",
  },
  rendering: {
    label: "Rendering",
    className: "bg-primary-surface text-primary-light",
  },
  failed: {
    label: "Failed",
    className: "bg-danger-surface text-danger-light",
  },
  queued: {
    label: "Queued",
    className: "bg-warning-surface text-warning-light",
  },
};

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "\u2014";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function computeProgressPercent(job: RenderJob): number {
  const completed = job.stages.filter((s) => s.status === "completed").length;
  return Math.round((completed / job.stages.length) * 100);
}

// -----------------------------------------------------------------------
// Render stage tracker component
// -----------------------------------------------------------------------

function RenderStageTracker({
  stages,
}: {
  stages: RenderStage[];
}): React.ReactElement {
  return (
    <div className="flex items-center">
      {RENDER_STAGES.map((stageDef, idx) => {
        const stage = stages.find((s) => s.name === stageDef.key);
        const status = stage?.status ?? "pending";
        const Icon = stageDef.icon;

        return (
          <div key={stageDef.key} className="flex items-center">
            {/* Connector line */}
            {idx > 0 && (
              <div
                className={cn(
                  "h-0.5 flex-1 min-w-8 sm:min-w-12",
                  status === "completed"
                    ? "bg-success-light/50"
                    : status === "running"
                      ? "bg-primary-light/50"
                      : status === "failed"
                        ? "bg-danger-light/50"
                        : "bg-border",
                )}
              />
            )}

            {/* Stage circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  status === "completed" &&
                    "bg-success-surface text-success-light",
                  status === "running" &&
                    "bg-primary-surface text-primary-light",
                  status === "failed" &&
                    "bg-danger-surface text-danger-light",
                  status === "pending" &&
                    "bg-surface-elevated text-text-dim",
                )}
                title={`${stageDef.label}: ${status}`}
              >
                {status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : status === "failed" ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "text-[10px] font-medium leading-tight",
                    status === "completed" && "text-success-light",
                    status === "running" && "text-primary-light",
                    status === "failed" && "text-danger-light",
                    status === "pending" && "text-text-dim",
                  )}
                >
                  {stageDef.label}
                </span>
                <span className="text-[10px] leading-tight text-text-dim">
                  {status === "completed" && stage?.duration_seconds !== null
                    ? formatDuration(stage!.duration_seconds)
                    : status === "running"
                      ? "In progress..."
                      : status === "failed"
                        ? "Failed"
                        : "\u00A0"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------
// Active render card component
// -----------------------------------------------------------------------

function ActiveRenderCard({
  job,
}: {
  job: RenderJob;
}): React.ReactElement {
  const progress = computeProgressPercent(job);
  const badge = STATUS_BADGE[job.status];

  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Film className="h-5 w-5 text-primary-light" />
          <div>
            <h3 className="text-sm font-semibold text-text">
              {job.content_title}
            </h3>
            <p className="text-xs text-text-dim">{job.content_id}</p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
            badge.className,
          )}
        >
          {badge.label}
        </span>
      </div>

      {/* Stage tracker */}
      <div className="mb-4 flex justify-center">
        <RenderStageTracker stages={job.stages} />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full glass-track">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            job.status === "rendering"
              ? "bg-primary-light"
              : job.status === "queued"
                ? "bg-warning-light"
                : "bg-success-light",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-[10px] text-text-dim">
        {progress}% complete
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------
// Page component
// -----------------------------------------------------------------------

interface RenderListResponse {
  items: RenderJob[];
  total: number;
}

export default async function VideoPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token && !DEMO_MODE) {
    redirect("/login");
  }

  let renders: RenderJob[] = [];
  let fetchError = false;

  if (DEMO_MODE) {
    renders = DEMO_RENDERS;
  } else {
    try {
      const res = await serverFetch<RenderListResponse>(
        "/api/v1/editor/renders?limit=50",
        {},
        token,
      );
      renders = res.items;
    } catch {
      fetchError = true;
    }
  }

  // Compute stats
  const totalRenders = renders.length;
  const completedRenders = renders.filter((r) => r.status === "completed").length;
  const failedRenders = renders.filter((r) => r.status === "failed").length;
  const successRate =
    completedRenders + failedRenders > 0
      ? Math.round((completedRenders / (completedRenders + failedRenders)) * 100)
      : 0;
  const activeRenders = renders.filter(
    (r) => r.status === "rendering" || r.status === "queued",
  ).length;
  const completedDurations = renders
    .filter((r) => r.total_duration_seconds !== null)
    .map((r) => r.total_duration_seconds!);
  const avgRenderTime =
    completedDurations.length > 0
      ? Math.round(
          completedDurations.reduce((a, b) => a + b, 0) /
            completedDurations.length,
        )
      : null;

  // Split active and history
  const activeJobs = renders.filter(
    (r) => r.status === "rendering" || r.status === "queued",
  );
  const historyJobs = renders.filter(
    (r) => r.status === "completed" || r.status === "failed",
  );

  const hasActiveRenders = activeJobs.length > 0;

  return (
    <div className="space-y-6">
      {/* Poller for active renders */}
      <VideoPoller hasActiveRenders={hasActiveRenders} />

      {/* Error banner */}
      {fetchError && (
        <div className="rounded-xl border border-warning-surface bg-warning-surface/30 p-4 text-sm text-warning-light">
          Unable to load render data. The Editor service may not be running.
        </div>
      )}

      {/* Status summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Renders"
          value={totalRenders}
          subtitle="All render jobs"
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          subtitle="Completed vs failed"
        />
        <StatCard
          title="Active Renders"
          value={activeRenders}
          subtitle="Rendering or queued"
        />
        <StatCard
          title="Avg Render Time"
          value={formatDuration(avgRenderTime)}
          subtitle="Across completed jobs"
        />
      </div>

      {/* Active renders section */}
      {activeJobs.length > 0 && (
        <div>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold text-text">
            Active Renders
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {activeJobs.map((job) => (
              <ActiveRenderCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      {/* Render history table */}
      <div>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          Render History
        </h2>
        {historyJobs.length === 0 ? (
          <div className="glass-card luminous-border rounded-xl p-12 text-center">
            <Clock className="mx-auto mb-3 h-10 w-10 text-text-dim" />
            <p className="text-text-muted">No completed renders yet</p>
            <p className="mt-1 text-sm text-text-dim">
              Completed and failed render jobs will appear here.
            </p>
          </div>
        ) : (
          <div className="glass-card luminous-border overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface-elevated">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                      Content Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                      Output Format
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                      Completed At
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyJobs.map((job) => {
                    const badge = STATUS_BADGE[job.status];

                    return (
                      <tr key={job.id} className="group">
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-text">
                            {job.content_title}
                          </span>
                          {/* Error message for failed jobs */}
                          {job.error && (
                            <div className="mt-1 flex items-start gap-1.5">
                              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-danger-light" />
                              <span className="text-xs text-danger-light">
                                {job.error}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-text-muted">
                          {formatDuration(job.total_duration_seconds)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="inline-flex rounded bg-surface-elevated px-2 py-0.5 text-xs font-mono text-text-secondary">
                            {job.output_format}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-text-muted">
                          {job.completed_at ? (
                            <span title={formatDate(job.completed_at)}>
                              {formatRelativeTime(job.completed_at)}
                            </span>
                          ) : (
                            "\u2014"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
