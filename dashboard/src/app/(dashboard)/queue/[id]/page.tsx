import Link from "next/link";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Gauge,
  Image,
  Tag,
  Video,
} from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { ScriptPanel } from "@/components/script-panel";
import { ContentActions } from "@/components/content-actions";
import { VideoPlayerProvider } from "@/contexts/video-player-context";
import { cn, formatDate } from "@/lib/utils";
import { DEMO_MODE, GATEWAY_URL } from "@/lib/config";
import { demoContent, demoTrends, demoMediaAssets } from "@/lib/demo-data";
import type { Content, ScriptSegment } from "@/types/api";

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
  contentId: string
): Promise<ScriptSegment[]> {
  const response = await fetch(
    `${GATEWAY_URL}/api/v1/content/${contentId}/script`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 0 },
    }
  );

  if (!response.ok) return [];
  const data = await response.json();
  return (data.segments ?? data ?? []) as ScriptSegment[];
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-surface-elevated text-text-secondary" },
  generating: { label: "Generating", className: "bg-primary-surface text-primary-light" },
  review: { label: "In Review", className: "bg-warning-surface text-warning-light" },
  approved: { label: "Approved", className: "bg-success-surface text-success-light" },
  published: { label: "Published", className: "bg-info-surface text-info-light" },
  rejected: { label: "Rejected", className: "bg-danger-surface text-danger-light" },
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

  if (DEMO_MODE) {
    content = demoContent.find((c) => c.id === id) ?? null;
  } else {
    try {
      content = await fetchContent(token!, id);
    } catch {
      contentFetchError = true;
      content = null;
    }
  }

  if (!content) {
    if (contentFetchError) {
      return (
        <div className="p-8">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Some data may be unavailable. Services may not be running.
          </div>
        </div>
      );
    }
    notFound();
  }

  let segments: ScriptSegment[];
  if (DEMO_MODE) {
    segments = [];
  } else {
    try {
      segments = await fetchScriptSegments(token!, id);
    } catch {
      segmentsFetchError = true;
      segments = [];
    }
  }

  const statusInfo = STATUS_LABELS[content.status] ?? STATUS_LABELS.draft;

  // Look up associated trend and media assets for the detail view
  const trend = content.trend_id
    ? demoTrends.find((t) => t.id === content.trend_id)
    : undefined;
  const mediaAssets = DEMO_MODE
    ? demoMediaAssets.filter((a) => a.content_id === content.id)
    : [];

  return (
    <div className="p-8">
      {segmentsFetchError && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Some data may be unavailable. Services may not be running.
        </div>
      )}

      {/* Back navigation */}
      <Link
        href="/queue"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Queue
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-text">
              {content.title}
            </h1>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                statusInfo.className
              )}
            >
              {statusInfo.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Created {formatDate(content.created_at)}
            {content.confidence_score !== undefined && (
              <span className="ml-3">
                Confidence: {Math.round(content.confidence_score * 100)}%
              </span>
            )}
          </p>
        </div>

        {!DEMO_MODE && (
          <ContentActions contentId={content.id} status={content.status} />
        )}
      </div>

      {/* Detail cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Status */}
        <div className="glass-card rounded-xl p-4">
          <div className="mb-2 flex items-center gap-2 text-text-secondary">
            <Tag className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Status</span>
          </div>
          <span
            className={cn(
              "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusInfo.className
            )}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Confidence */}
        {content.confidence_score !== undefined && (
          <div className="glass-card rounded-xl p-4">
            <div className="mb-2 flex items-center gap-2 text-text-secondary">
              <Gauge className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Confidence</span>
            </div>
            <p className="text-lg font-semibold text-text">
              {Math.round(content.confidence_score * 100)}%
            </p>
          </div>
        )}

        {/* Created */}
        <div className="glass-card rounded-xl p-4">
          <div className="mb-2 flex items-center gap-2 text-text-secondary">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Created</span>
          </div>
          <p className="text-sm font-medium text-text">
            {formatDate(content.created_at)}
          </p>
        </div>

        {/* Updated */}
        {content.updated_at && (
          <div className="glass-card rounded-xl p-4">
            <div className="mb-2 flex items-center gap-2 text-text-secondary">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Updated</span>
            </div>
            <p className="text-sm font-medium text-text">
              {formatDate(content.updated_at)}
            </p>
          </div>
        )}
      </div>

      {/* Video + Script (non-demo or when video exists) */}
      {!DEMO_MODE && (
        <VideoPlayerProvider>
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <VideoPlayer
                videoUrl={content.video_url}
                thumbnailUrl={content.thumbnail_url}
                segments={segments}
              />
            </div>
            <div className="lg:col-span-1">
              <ScriptPanel
                script={content.script}
                segments={segments}
              />
            </div>
          </div>
        </VideoPlayerProvider>
      )}

      {/* Script (demo mode — show inline if available) */}
      {DEMO_MODE && content.script && (
        <div className="mb-6 glass-card rounded-xl p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-text">
            <FileText className="h-5 w-5 text-text-secondary" />
            Script
          </h2>
          <p className="whitespace-pre-wrap text-sm text-text-secondary">
            {content.script}
          </p>
        </div>
      )}

      {/* Description */}
      {content.body && (
        <div className="mb-6 glass-card rounded-xl p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-text">
            <FileText className="h-5 w-5 text-text-secondary" />
            Description
          </h2>
          <p className="whitespace-pre-wrap text-sm text-text-secondary">
            {content.body}
          </p>
        </div>
      )}

      {/* Associated Trend */}
      {trend && (
        <div className="mb-6 glass-card rounded-xl p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-text">
            <Tag className="h-5 w-5 text-text-secondary" />
            Associated Trend
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">{trend.topic}</p>
              <p className="mt-1 text-xs text-text-muted">
                Source: {trend.source}{trend.detected_at && <> &middot; Detected {formatDate(trend.detected_at)}</>}
              </p>
            </div>
            <span className="rounded-full bg-primary-surface px-2.5 py-0.5 text-xs font-medium text-primary-light">
              {Math.round(trend.virality_score * 100)}% viral
            </span>
          </div>
        </div>
      )}

      {/* Media Assets */}
      {mediaAssets.length > 0 && (
        <div className="glass-card rounded-xl p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-text">
            <Image className="h-5 w-5 text-text-secondary" />
            Media Assets
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mediaAssets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
              >
                {asset.type === "video" ? (
                  <Video className="h-5 w-5 text-text-secondary" />
                ) : (
                  <Image className="h-5 w-5 text-text-secondary" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {asset.url.split("/").pop()}
                  </p>
                  <p className="text-xs text-text-muted">
                    {asset.type}
                    {asset.width && asset.height && ` \u00b7 ${asset.width}\u00d7${asset.height}`}
                    {asset.duration && ` \u00b7 ${asset.duration}s`}
                    {asset.file_size != null && ` \u00b7 ${(asset.file_size / 1_000_000).toFixed(1)} MB`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
