import Link from "next/link";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  Image as ImageIcon,
  Video as VideoIcon,
  TrendingUp,
  Send,
} from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { ContentActions } from "@/components/content-actions";
import { VideoPlayerProvider } from "@/contexts/video-player-context";
import { PipelineStageIndicator } from "@/components/pipeline-stage-indicator";
import { ImageGallery } from "@/components/content-detail/image-gallery";
import { ContentScriptSection } from "@/components/content-detail/content-script-section";
import { ContentDetailPoller } from "@/components/content-detail/content-detail-poller";
import { cn, formatDate, resolveMediaUrl } from "@/lib/utils";
import { DEMO_MODE, GATEWAY_URL } from "@/lib/config";
import { demoContent, demoTrends, demoMediaAssets } from "@/lib/demo-data";
import { fetchPipelineStatus } from "@/lib/actions";
import type { Content, ScriptSegment, MediaAsset } from "@/types/api";
import type { PipelineRun } from "@/lib/demo-data";

interface ContentDetailPageProps {
  params: Promise<{ id: string }>;
}

async function fetchContent(token: string, id: string): Promise<Content | null> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/content/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!response.ok) return null;
  return (await response.json()) as Content;
}

async function fetchScriptSegments(
  token: string,
  contentId: string,
): Promise<ScriptSegment[]> {
  const response = await fetch(
    `${GATEWAY_URL}/api/v1/content/${contentId}/script`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 },
    },
  );
  if (!response.ok) return [];
  const data = await response.json();
  return (data.segments ?? data ?? []) as ScriptSegment[];
}

async function fetchMediaAssets(
  token: string,
  contentId: string,
): Promise<MediaAsset[]> {
  try {
    const response = await fetch(
      `${GATEWAY_URL}/api/v1/media/assets?content_id=${contentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 0 },
      },
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data.items ?? data ?? []) as MediaAsset[];
  } catch {
    return [];
  }
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-surface-elevated text-text-secondary",
  },
  generating: {
    label: "Generating",
    className: "bg-primary-surface text-primary-light",
  },
  review: {
    label: "In Review",
    className: "bg-warning-surface text-warning-light",
  },
  approved: {
    label: "Approved",
    className: "bg-success-surface text-success-light",
  },
  published: {
    label: "Published",
    className: "bg-info-surface text-info-light",
  },
  rejected: {
    label: "Rejected",
    className: "bg-danger-surface text-danger-light",
  },
};

export default async function ContentDetailPage({
  params,
}: ContentDetailPageProps): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token && !DEMO_MODE) {
    redirect("/login");
  }

  const { id } = await params;

  let contentFetchError = false;
  let segmentsFetchError = false;
  let content: Content | null;
  let segments: ScriptSegment[];
  let mediaAssets: MediaAsset[];
  let pipelineRun: PipelineRun | null = null;

  if (DEMO_MODE) {
    content = demoContent.find((c) => c.id === id) ?? null;
    segments = [];
    mediaAssets = demoMediaAssets.filter((a) => a.content_id === id);
  } else {
    try {
      content = await fetchContent(token!, id);
    } catch {
      contentFetchError = true;
      content = null;
    }

    if (!content) {
      if (contentFetchError) {
        return (
          <div className="p-8">
            <div className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning-light">
              Some data may be unavailable. Services may not be running.
            </div>
          </div>
        );
      }
      notFound();
    }

    [segments, mediaAssets, pipelineRun] = await Promise.all([
      fetchScriptSegments(token!, id).catch(() => {
        segmentsFetchError = true;
        return [] as ScriptSegment[];
      }),
      fetchMediaAssets(token!, id),
      fetchPipelineStatus(id),
    ]);
  }

  if (!content) {
    notFound();
  }

  const statusInfo = STATUS_LABELS[content.status] ?? STATUS_LABELS.draft;
  const isGenerating = content.status === "generating";
  const imageCount = mediaAssets.filter((a) => a.type === "image").length;

  const trend = content.trend_id
    ? demoTrends.find((t) => t.id === content.trend_id)
    : undefined;

  return (
    <div className="space-y-6 p-4 sm:p-8">
      {/* Background poller while generating */}
      <ContentDetailPoller isGenerating={isGenerating} />

      {/* Error banners */}
      {segmentsFetchError && (
        <div className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning-light">
          Script segments unavailable. Services may not be running.
        </div>
      )}

      {/* Back nav */}
      <Link
        href="/queue"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Queue
      </Link>

      {/* Pipeline progress bar */}
      <div className="glass-card luminous-border rounded-xl px-6 py-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-secondary">
            Generation Pipeline
          </h3>
          {isGenerating && (
            <span className="animate-pulse text-xs text-primary-light">
              Generating…
            </span>
          )}
        </div>
        <PipelineStageIndicator
          content={content}
          pipelineRun={pipelineRun ?? undefined}
          size="lg"
        />
      </div>

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-text">
              {content.title}
            </h1>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                statusInfo.className,
              )}
            >
              {statusInfo.label}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-text-muted">
            <span>Created {formatDate(content.created_at)}</span>
            {trend && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                {trend.topic}
              </span>
            )}
            {content.confidence_score !== undefined && (
              <span>
                Confidence: {Math.round(content.confidence_score * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column content layout */}
      <VideoPlayerProvider>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ── LEFT: Script + Publish Status ── */}
          <div className="space-y-6 lg:col-span-5">
            {/* Panel A: Script */}
            <div className="glass-card luminous-border overflow-hidden rounded-xl">
              <ContentScriptSection
                script={content.script}
                segments={segments}
              />
            </div>

            {/* Panel B: Publish Status */}
            <div className="glass-card luminous-border rounded-xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <Send className="h-4 w-4 text-text-secondary" />
                <h2 className="text-base font-semibold text-text">
                  Publish Status
                </h2>
              </div>

              {/* Large status badge */}
              <div className="mb-4">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold",
                    statusInfo.className,
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {statusInfo.label}
                </span>
              </div>

              {/* Platform label */}
              <p className="mb-4 flex items-center gap-1.5 text-xs text-text-muted">
                <span className="font-mono">𝕏</span>
                Twitter / X
              </p>

              {/* Approve / Reject / Publish actions */}
              {!DEMO_MODE && (
                <ContentActions
                  contentId={content.id}
                  status={content.status}
                />
              )}

              {/* Published timestamp */}
              {content.published_at && (
                <p className="mt-3 text-xs text-text-dim">
                  Published {formatDate(content.published_at)}
                </p>
              )}
            </div>
          </div>

          {/* ── RIGHT: Images + Video ── */}
          <div className="space-y-6 lg:col-span-7">
            {/* Panel C: Generated Images */}
            <div className="glass-card luminous-border rounded-xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-text-secondary" />
                <h2 className="text-base font-semibold text-text">
                  Generated Images
                </h2>
                {imageCount > 0 && (
                  <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-muted">
                    {imageCount}
                  </span>
                )}
              </div>
              <ImageGallery
                assets={mediaAssets}
                isGenerating={isGenerating}
              />
            </div>

            {/* Panel D: Video */}
            <div className="glass-card luminous-border overflow-hidden rounded-xl">
              <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                <VideoIcon className="h-4 w-4 text-text-secondary" />
                <h2 className="text-base font-semibold text-text">Video</h2>
              </div>

              {content.video_url ? (
                <VideoPlayer
                  videoUrl={resolveMediaUrl(content.video_url)}
                  thumbnailUrl={resolveMediaUrl(content.thumbnail_url)}
                  segments={segments}
                />
              ) : (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  {isGenerating ? (
                    <>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-surface">
                        <VideoIcon className="h-6 w-6 animate-pulse text-primary-light" />
                      </div>
                      <p className="text-sm font-medium text-text-secondary">
                        Video is being assembled
                      </p>
                      <p className="mt-1 text-xs text-text-dim">
                        TTS → captions → stitching → done
                      </p>
                    </>
                  ) : (
                    <>
                      <VideoIcon className="mb-3 h-10 w-10 text-text-dim" />
                      <p className="text-sm text-text-muted">
                        No video generated yet.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </VideoPlayerProvider>
    </div>
  );
}
