import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import { ScriptPanel } from "@/components/script-panel";
import { ContentActions } from "@/components/content-actions";
import { VideoPlayerProvider } from "@/contexts/video-player-context";
import { cn, formatDate } from "@/lib/utils";
import type { Content, ScriptSegment } from "@/types/api";
import { GATEWAY_URL } from "@/lib/config";

interface ContentDetailPageProps {
  params: Promise<{ id: string }>;
}

async function fetchContent(token: string, id: string): Promise<Content | null> {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/v1/content/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 30 },
    });

    if (!response.ok) return null;
    return (await response.json()) as Content;
  } catch {
    return null;
  }
}

async function fetchScriptSegments(
  token: string,
  contentId: string
): Promise<ScriptSegment[]> {
  try {
    const response = await fetch(
      `${GATEWAY_URL}/api/v1/content/${contentId}/script`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 30 },
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    return (data.segments ?? data ?? []) as ScriptSegment[];
  } catch {
    return [];
  }
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

  if (!token) {
    redirect("/login");
  }

  const { id } = await params;
  const content = await fetchContent(token, id);

  if (!content) {
    notFound();
  }

  const segments = await fetchScriptSegments(token, id);
  const statusInfo = STATUS_LABELS[content.status] ?? STATUS_LABELS.draft;

  return (
    <div className="p-8">
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

        <ContentActions contentId={content.id} status={content.status} />
      </div>

      {/* Video + Script */}
      <VideoPlayerProvider>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

      {/* Description */}
      {content.body && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-3 text-lg font-semibold text-text">
            Description
          </h2>
          <p className="whitespace-pre-wrap text-sm text-text-secondary">
            {content.body}
          </p>
        </div>
      )}
    </div>
  );
}
