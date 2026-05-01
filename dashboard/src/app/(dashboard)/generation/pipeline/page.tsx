import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverFetch } from "@/lib/api-client";
import { fetchPipelineStatus } from "@/lib/actions";
import { DEMO_MODE } from "@/lib/config";
import { demoContent, demoPipelineRuns } from "@/lib/demo-data";
import type { PipelineRun } from "@/lib/demo-data";
import { EmptyState } from "@/components/ui/empty-state";
import { PIPELINE_STAGES, PipelineStageIndicator } from "@/components/pipeline-stage-indicator";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import type { Content, ContentStatus, PaginatedResponse } from "@/types/api";
import {
  Check,
  Clock,
  FileText,
  Film,
  Filter,
  ImageIcon,
  Send,
  Sparkles,
} from "lucide-react";
import {
  GenerationBadge,
  GenerationCard,
  GenerationEyebrow,
  GenerationProgressTrack,
  GenerationSectionHeading,
  GenerationStatusDot,
} from "@/components/generation-ui-kit";
import { PipelinePoller } from "./pipeline-poller";

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

function badgeTone(status: string): "violet" | "green" | "amber" | "red" {
  if (status === "approved" || status === "published") return "green";
  if (status === "failed" || status === "rejected") return "red";
  if (status === "draft" || status === "review") return "amber";
  return "violet";
}

function runProgress(run: PipelineRun | undefined, content: Content): number {
  if (run && run.stages_total > 0) {
    return Math.round((run.stages_completed / run.stages_total) * 100);
  }
  if (content.status === "approved" || content.status === "published" || content.status === "review") {
    return 100;
  }
  if (content.status === "draft") return 5;
  if (content.status === "rejected") return 35;
  return 50;
}

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

      // Fetch pipeline status for each content item in parallel
      const pipelineResults = await Promise.all(
        contentItems.map((item) => fetchPipelineStatus(item.id)),
      );
      for (const run of pipelineResults) {
        if (run) {
          pipelineRuns.push(run);
        }
      }
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

  const agentRows = [
    {
      name: "Scout",
      sub: ":8001 · healthy",
      pct: contentItems.length > 0 ? 95 : 0,
      tone: "green" as const,
      label: "Active",
      dot: "green" as const,
    },
    {
      name: "Director",
      sub: ":8002 · orchestration",
      pct: Math.min(100, counts.running * 24 + counts.queued * 8),
      tone: "violet" as const,
      label: counts.running > 0 ? "Scripting" : "Ready",
      dot: counts.running > 0 ? ("green" as const) : ("grey" as const),
    },
    {
      name: "Media",
      sub: ":8003 · image queue",
      pct: Math.min(100, counts.running * 18 + counts.completed * 6),
      tone: "cyan" as const,
      label: counts.running > 0 ? "Rendering" : "Idle",
      dot: counts.running > 0 ? ("amber" as const) : ("grey" as const),
    },
    {
      name: "Editor",
      sub: ":8004 · assembly",
      pct: Math.min(100, counts.completed * 14),
      tone: "amber" as const,
      label: counts.completed > 0 ? "Assembling" : "Queued",
      dot: counts.completed > 0 ? ("amber" as const) : ("grey" as const),
    },
    {
      name: "Publisher",
      sub: ":8006 · healthy",
      pct: Math.min(100, counts.completed * 20),
      tone: "violet" as const,
      label: "Queued",
      dot: "green" as const,
    },
  ];

  const jobCards = filteredContent.slice(0, 3);
  const timelineItems = contentItems.slice(0, 5);

  return (
    <div className="space-y-6">
      <PipelinePoller hasActiveItems={hasActiveItems} />

      {fetchError && (
        <div className="rounded-xl border border-warning-surface bg-warning-surface/30 p-4 text-sm text-warning-light">
          Unable to load pipeline data. Services may not be running.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Pending / Queued", counts.queued, "Awaiting processing"],
          ["In Progress", counts.running, "Currently generating"],
          ["Completed", counts.completed, "Review, approved, or published"],
          ["Failed", counts.failed, "Errors encountered"],
        ].map(([title, value, subtitle]) => (
          <GenerationCard key={title} className="p-5">
            <GenerationEyebrow>{title}</GenerationEyebrow>
            <div className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-text">
              {value}
            </div>
            <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
          </GenerationCard>
        ))}
      </div>

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
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary-surface text-primary-light"
                    : "border border-border bg-surface-elevated/70 text-text-muted hover:bg-surface-hover hover:text-text-secondary",
                )}
              >
                {opt.label}
              </a>
            );
          })}
        </div>
      </div>

      {filteredContent.length === 0 ? (
        statusFilter ? (
          <GenerationCard className="p-12 text-center">
            <Clock className="mx-auto mb-3 h-10 w-10 text-text-dim" />
            <p className="text-text-muted">No items match this filter</p>
            <p className="mt-1 text-sm text-text-dim">Try changing the status filter.</p>
          </GenerationCard>
        ) : (
          <EmptyState
            icon={<Sparkles className="h-7 w-7" />}
            title="No content in the pipeline"
            description="Content will appear here as trends are processed through the generation pipeline."
            action={{ label: "View Trends", href: "/trends" }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="space-y-4">
            <GenerationCard className="p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <GenerationEyebrow className="mb-1">Swarm</GenerationEyebrow>
                  <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                    Agent Status
                  </h2>
                </div>
                <GenerationBadge tone={counts.failed > 0 ? "amber" : "green"}>
                  {agentRows.filter((row) => row.dot !== "grey").length} / 5 Online
                </GenerationBadge>
              </div>

              <div className="divide-y divide-border/60">
                {agentRows.map((agent) => (
                  <div
                    key={agent.name}
                    className="grid grid-cols-1 gap-3 py-3.5 md:grid-cols-[130px_minmax(120px,1fr)_56px_112px] md:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <GenerationStatusDot tone={agent.dot} pulse={agent.dot !== "grey"} />
                        <span className="font-[family-name:var(--font-display)] text-sm font-medium text-text">
                          {agent.name}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-text-muted">
                        {agent.sub}
                      </div>
                    </div>
                    <GenerationProgressTrack value={agent.pct} tone={agent.tone} />
                    <div className="font-mono text-xs text-text text-right">{agent.pct}%</div>
                    <GenerationBadge
                      tone={
                        agent.label === "Active"
                          ? "green"
                          : agent.label === "Rendering" || agent.label === "Assembling"
                            ? "amber"
                            : "violet"
                      }
                      className="justify-center uppercase tracking-[0.18em]"
                    >
                      {agent.label}
                    </GenerationBadge>
                  </div>
                ))}
              </div>
            </GenerationCard>

            <GenerationCard className="p-5 sm:p-6">
              <GenerationEyebrow className="mb-3">Active Jobs</GenerationEyebrow>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {jobCards.map((content) => {
                  const run = runsByContentId.get(content.id);
                  const progress = runProgress(run, content);
                  const badge = STATUS_BADGE[content.status] ?? STATUS_BADGE.draft;

                  return (
                    <div
                      key={content.id}
                      className="rounded-lg border border-border bg-surface-elevated/70 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-text">
                            {content.title}
                          </div>
                          <div className="mt-1 font-mono text-[11px] text-text-muted">
                            {content.id} · {currentStageLabel(content, run)}
                          </div>
                        </div>
                        <GenerationBadge tone={badgeTone(content.status)}>{badge.label}</GenerationBadge>
                      </div>
                      <div className="mt-3">
                        <GenerationProgressTrack
                          value={progress}
                          tone={content.status === "rejected" ? "red" : "violet"}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GenerationCard>

            <GenerationCard className="overflow-hidden">
              <div className="p-5 pb-0 sm:p-6 sm:pb-0">
                <GenerationSectionHeading>Workflow Cards</GenerationSectionHeading>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="border-y border-border bg-surface-elevated/70">
                    <tr>
                      {["Title", "Pipeline Stage", "Current Stage", "Status", "Created", "Duration"].map((head) => (
                        <th
                          key={head}
                          className="px-5 py-3 text-left font-[family-name:var(--font-label)] text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredContent.map((content) => {
                      const run = runsByContentId.get(content.id);
                      const badge = STATUS_BADGE[content.status] ?? STATUS_BADGE.draft;

                      return (
                        <tr
                          key={content.id}
                          className="transition-colors hover:bg-surface-hover/60"
                        >
                          <td className="px-5 py-4">
                            <span className="text-sm font-medium text-text">
                              {content.title}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <PipelineStageIndicator
                              content={content}
                              pipelineRun={run}
                            />
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-sm text-text-secondary">
                            {currentStageLabel(content, run)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <GenerationBadge tone={badgeTone(content.status)}>
                              {badge.label}
                            </GenerationBadge>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-sm text-text-muted">
                            <span title={formatDate(content.created_at)}>
                              {formatRelativeTime(content.created_at)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-sm text-text-muted">
                            {computeDuration(content, run)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GenerationCard>
          </div>

          <GenerationCard className="p-5 sm:p-6">
            <GenerationEyebrow className="mb-4">Pipeline Timeline</GenerationEyebrow>
            <div>
              {timelineItems.map((content, idx) => {
                const run = runsByContentId.get(content.id);
                const icons = [Check, Sparkles, ImageIcon, Film, Send];
                const Icon = icons[idx] ?? FileText;
                const muted = idx > 2;

                return (
                  <div
                    key={content.id}
                    className={cn(
                      "relative flex items-start gap-4 pb-5 last:pb-0",
                      idx < timelineItems.length - 1 &&
                        "after:absolute after:left-[9px] after:top-9 after:bottom-0 after:w-px after:bg-border",
                      muted && "opacity-60",
                    )}
                  >
                    <div
                      className={cn(
                        "z-[1] mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                        idx === 0 && "bg-success-surface text-success-light",
                        idx === 1 && "bg-primary-surface text-primary-light",
                        idx === 2 && "bg-cyan-surface text-cyan-light",
                        idx > 2 && "bg-surface-elevated text-text-muted",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text">
                        {currentStageLabel(content, run)}
                      </div>
                      <div className="mt-0.5 text-[12px] text-text-secondary">
                        {content.title}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-text-muted">
                        {formatRelativeTime(content.created_at)} · pipeline.{content.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GenerationCard>
        </div>
      )}
    </div>
  );
}
