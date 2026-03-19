import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverFetch } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";
import { demoContent, demoPipelineRuns } from "@/lib/demo-data";
import type { PipelineRun } from "@/lib/demo-data";
import { StatCard } from "@/components/charts/stat-card";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import type { Content, ContentStatus, PaginatedResponse } from "@/types/api";
import {
  Search,
  FileText,
  MessageSquare,
  Palette,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  XCircle,
  Filter,
} from "lucide-react";
import { PipelinePoller } from "./pipeline-poller";

// -----------------------------------------------------------------------
// Pipeline stage definitions
// -----------------------------------------------------------------------

const PIPELINE_STAGES = [
  { key: "analyst", label: "Analyst", icon: Search },
  { key: "critique", label: "Critique", icon: MessageSquare },
  { key: "script", label: "Script", icon: FileText },
  { key: "visuals", label: "Visual Prompts", icon: Palette },
  { key: "done", label: "Done", icon: CheckCircle2 },
] as const;

// -----------------------------------------------------------------------
// Status badge styles
// -----------------------------------------------------------------------

const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-warning-surface text-warning-light",
  },
  generating: {
    label: "Generating",
    className: "bg-primary-surface text-primary-light",
  },
  review: {
    label: "Awaiting Review",
    className: "bg-warning-surface text-warning-light",
  },
  approved: {
    label: "Approved",
    className: "bg-success-surface text-success-light",
  },
  published: {
    label: "Published",
    className: "bg-success-surface text-success-light",
  },
  rejected: {
    label: "Rejected",
    className: "bg-danger-surface text-danger-light",
  },
  failed: {
    label: "Failed",
    className: "bg-danger-surface text-danger-light",
  },
};

// -----------------------------------------------------------------------
// Stage indicator component
// -----------------------------------------------------------------------

function stageStatusForContent(
  content: Content,
  pipelineRun: PipelineRun | undefined,
  stageIndex: number,
): "completed" | "running" | "pending" | "failed" {
  if (content.status === "rejected" || pipelineRun?.status === "failed") {
    const failedAt = pipelineRun?.stages_completed ?? 0;
    // Map stages_completed (out of 6) to our 5-stage display
    const displayFailed = Math.min(
      Math.floor((failedAt / (pipelineRun?.stages_total ?? 6)) * PIPELINE_STAGES.length),
      PIPELINE_STAGES.length - 1,
    );
    if (stageIndex < displayFailed) return "completed";
    if (stageIndex === displayFailed) return "failed";
    return "pending";
  }

  if (
    content.status === "approved" ||
    content.status === "published" ||
    content.status === "review"
  ) {
    return "completed";
  }

  if (content.status === "generating" && pipelineRun) {
    const completedStages = pipelineRun.stages_completed;
    const total = pipelineRun.stages_total;
    const displayCompleted = Math.floor(
      (completedStages / total) * PIPELINE_STAGES.length,
    );
    if (stageIndex < displayCompleted) return "completed";
    if (stageIndex === displayCompleted) return "running";
    return "pending";
  }

  if (content.status === "draft") {
    return "pending";
  }

  return "pending";
}

function PipelineStageIndicator({
  content,
  pipelineRun,
}: {
  content: Content;
  pipelineRun: PipelineRun | undefined;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-0">
      {PIPELINE_STAGES.map((stage, idx) => {
        const status = stageStatusForContent(content, pipelineRun, idx);
        const Icon = stage.icon;

        return (
          <div key={stage.key} className="flex items-start">
            {/* Connector line — vertically centered to the icon row */}
            {idx > 0 && (
              <div className="flex h-7 items-center">
                <div
                  className={cn(
                    "h-0.5 w-6 sm:w-8",
                    status === "completed"
                      ? "bg-success-light/50"
                      : status === "running"
                        ? "bg-primary-light/50"
                        : status === "failed"
                          ? "bg-danger-light/50"
                          : "bg-border",
                  )}
                />
              </div>
            )}

            {/* Stage circle + label — fixed width for consistent spacing */}
            <div className="flex w-11 flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                  status === "completed" &&
                    "bg-success-surface text-success-light",
                  status === "running" &&
                    "bg-primary-surface text-primary-light",
                  status === "failed" &&
                    "bg-danger-surface text-danger-light",
                  status === "pending" &&
                    "bg-surface-elevated text-text-dim",
                )}
                title={`${stage.label}: ${status}`}
              >
                {status === "completed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : status === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : status === "failed" ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={cn(
                  "w-full text-center text-[10px] leading-tight",
                  status === "completed" && "text-success-light",
                  status === "running" && "text-primary-light",
                  status === "failed" && "text-danger-light",
                  status === "pending" && "text-text-dim",
                )}
              >
                {stage.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------
// Duration helper
// -----------------------------------------------------------------------

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function computeDuration(
  content: Content,
  pipelineRun: PipelineRun | undefined,
): string {
  if (pipelineRun?.duration_seconds !== null && pipelineRun?.duration_seconds !== undefined) {
    return formatDuration(pipelineRun.duration_seconds);
  }
  if (pipelineRun?.status === "running" && pipelineRun.started_at) {
    const elapsed = Math.floor(
      (Date.now() - new Date(pipelineRun.started_at).getTime()) / 1000,
    );
    return `${formatDuration(elapsed)} (running)`;
  }
  return "--";
}

// -----------------------------------------------------------------------
// Current stage label
// -----------------------------------------------------------------------

function currentStageLabel(
  content: Content,
  pipelineRun: PipelineRun | undefined,
): string {
  if (
    content.status === "approved" ||
    content.status === "published" ||
    content.status === "review"
  ) {
    return "Done";
  }

  if (content.status === "rejected" || pipelineRun?.status === "failed") {
    const failedAt = pipelineRun?.stages_completed ?? 0;
    const displayIdx = Math.min(
      Math.floor(
        (failedAt / (pipelineRun?.stages_total ?? 6)) * PIPELINE_STAGES.length,
      ),
      PIPELINE_STAGES.length - 1,
    );
    return PIPELINE_STAGES[displayIdx].label;
  }

  if (content.status === "generating" && pipelineRun) {
    const displayIdx = Math.min(
      Math.floor(
        (pipelineRun.stages_completed / pipelineRun.stages_total) *
          PIPELINE_STAGES.length,
      ),
      PIPELINE_STAGES.length - 1,
    );
    return PIPELINE_STAGES[displayIdx].label;
  }

  if (content.status === "draft") return "Queued";
  return "--";
}

// -----------------------------------------------------------------------
// Status filter options
// -----------------------------------------------------------------------

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "generating", label: "Generating" },
  { value: "review", label: "Review" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

// -----------------------------------------------------------------------
// Page props
// -----------------------------------------------------------------------

interface PipelinePageProps {
  searchParams: Promise<{
    status?: ContentStatus;
  }>;
}

// -----------------------------------------------------------------------
// Page component
// -----------------------------------------------------------------------

export default async function PipelinePage({
  searchParams,
}: PipelinePageProps): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token && !DEMO_MODE) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const statusFilter = resolvedParams.status;

  let contentItems: Content[] = [];
  let pipelineRuns: PipelineRun[] = [];
  let fetchError = false;

  if (DEMO_MODE) {
    contentItems = demoContent;
    pipelineRuns = demoPipelineRuns;
  } else {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");

      const res = await serverFetch<PaginatedResponse<Content>>(
        `/api/v1/content?${params.toString()}`,
        {},
        token,
      );
      contentItems = res.items;
    } catch {
      fetchError = true;
    }
  }

  // Apply client-side status filter for demo data
  const filteredContent = statusFilter
    ? contentItems.filter((c) => c.status === statusFilter)
    : contentItems;

  // Build a lookup map for pipeline runs by content_id
  const runsByContentId = new Map<string, PipelineRun>();
  for (const run of pipelineRuns) {
    const existing = runsByContentId.get(run.content_id);
    // Keep the most recent run per content item
    if (!existing || new Date(run.started_at) > new Date(existing.started_at)) {
      runsByContentId.set(run.content_id, run);
    }
  }

  // Status counts (from unfiltered list)
  const counts = {
    queued: contentItems.filter(
      (c) =>
        c.status === "draft" ||
        pipelineRuns.some(
          (r) => r.content_id === c.id && r.status === "queued",
        ),
    ).length,
    running: contentItems.filter(
      (c) =>
        c.status === "generating" ||
        pipelineRuns.some(
          (r) => r.content_id === c.id && r.status === "running",
        ),
    ).length,
    completed: contentItems.filter(
      (c) =>
        c.status === "approved" ||
        c.status === "published" ||
        c.status === "review",
    ).length,
    failed: contentItems.filter(
      (c) =>
        c.status === "rejected" ||
        pipelineRuns.some(
          (r) => r.content_id === c.id && r.status === "failed",
        ),
    ).length,
  };

  const hasActiveItems = contentItems.some(
    (c) => c.status === "generating",
  );

  return (
    <div className="space-y-6">
      {/* Poller for active items */}
      <PipelinePoller hasActiveItems={hasActiveItems} />

      {/* Error banner */}
      {fetchError && (
        <div className="rounded-xl border border-warning-surface bg-warning-surface/30 p-4 text-sm text-warning-light">
          Unable to load pipeline data. Services may not be running.
        </div>
      )}

      {/* Status summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending / Queued"
          value={counts.queued}
          subtitle="Awaiting processing"
        />
        <StatCard
          title="In Progress"
          value={counts.running}
          subtitle="Currently generating"
        />
        <StatCard
          title="Completed"
          value={counts.completed}
          subtitle="Review, approved, or published"
        />
        <StatCard
          title="Failed"
          value={counts.failed}
          subtitle="Errors encountered"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-text-muted" />
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => {
            const isActive =
              (opt.value === "" && !statusFilter) ||
              opt.value === statusFilter;
            const href = opt.value
              ? `/generation/pipeline?status=${opt.value}`
              : "/generation/pipeline";

            return (
              <a
                key={opt.value}
                href={href}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary-surface text-primary-light"
                    : "bg-surface-elevated text-text-muted hover:bg-surface-hover hover:text-text-secondary",
                )}
              >
                {opt.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* Content table */}
      {filteredContent.length === 0 ? (
        <div className="glass-card luminous-border rounded-xl p-12 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 text-text-dim" />
          <p className="text-text-muted">No pipeline items found</p>
          <p className="mt-1 text-sm text-text-dim">
            {statusFilter
              ? "Try changing the status filter."
              : "Content will appear here when generation starts."}
          </p>
        </div>
      ) : (
        <div className="glass-card luminous-border overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    Pipeline Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    Current Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredContent.map((content) => {
                  const run = runsByContentId.get(content.id);
                  const badge =
                    STATUS_BADGE[content.status] ?? STATUS_BADGE.draft;

                  return (
                    <tr
                      key={content.id}
                      className="transition-colors hover:bg-surface-hover"
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-text">
                          {content.title}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <PipelineStageIndicator
                          content={content}
                          pipelineRun={run}
                        />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-text-secondary">
                        {currentStageLabel(content, run)}
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
                        <span title={formatDate(content.created_at)}>
                          {formatRelativeTime(content.created_at)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-text-muted">
                        {computeDuration(content, run)}
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
  );
}
