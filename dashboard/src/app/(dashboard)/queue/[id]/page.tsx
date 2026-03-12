import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import { ScriptPanel } from "@/components/script-panel";
import { ContentActions } from "@/components/content-actions";
import { cn, formatDate } from "@/lib/utils";
import type { Content, ScriptSegment } from "@/types/api";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8000";

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
      next: { revalidate: 0 },
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
        next: { revalidate: 0 },
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
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  generating: { label: "Generating", className: "bg-purple-100 text-purple-700" },
  review: { label: "In Review", className: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  published: { label: "Published", className: "bg-blue-100 text-blue-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
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
            <h1 className="text-2xl font-bold text-gray-900">
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
          <p className="mt-1 text-sm text-gray-500">
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

      {/* Description */}
      {content.body && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Description
          </h2>
          <p className="whitespace-pre-wrap text-sm text-gray-600">
            {content.body}
          </p>
        </div>
      )}
    </div>
  );
}
