"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  useWebSocket,
  type WebSocketMessage,
} from "@/hooks/use-websocket";
import {
  Search,
  FileText,
  MessageSquare,
  ImageIcon,
  Video,
  Film,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
} from "lucide-react";

interface StageProgress {
  stage: string;
  label: string;
  icon: React.ReactNode;
  status: "pending" | "running" | "completed" | "failed";
  progress: number; // 0–100
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

interface PipelineProgress {
  contentId: string;
  title: string;
  stages: StageProgress[];
  estimatedTimeRemaining: number | null; // seconds
}

const STAGE_DEFINITIONS: { stage: string; label: string; icon: React.ReactNode }[] = [
  { stage: "research", label: "Research", icon: <Search className="h-4 w-4" /> },
  { stage: "script", label: "Script", icon: <FileText className="h-4 w-4" /> },
  { stage: "critique", label: "Critique", icon: <MessageSquare className="h-4 w-4" /> },
  { stage: "images", label: "Images", icon: <ImageIcon className="h-4 w-4" /> },
  { stage: "video", label: "Video", icon: <Video className="h-4 w-4" /> },
  { stage: "render", label: "Render", icon: <Film className="h-4 w-4" /> },
];

function createDefaultStages(): StageProgress[] {
  return STAGE_DEFINITIONS.map((s) => ({
    ...s,
    status: "pending" as const,
    progress: 0,
    startedAt: null,
    completedAt: null,
    error: null,
  }));
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s remaining`;
}

function StageRow({ stage }: { stage: StageProgress }): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full",
          stage.status === "completed" && "bg-green-100 text-green-600",
          stage.status === "running" && "bg-blue-100 text-blue-600",
          stage.status === "failed" && "bg-red-100 text-red-600",
          stage.status === "pending" && "bg-gray-100 text-gray-400"
        )}
      >
        {stage.status === "running" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : stage.status === "completed" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : stage.status === "failed" ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          stage.icon
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-sm font-medium",
              stage.status === "running" && "text-blue-700",
              stage.status === "completed" && "text-green-700",
              stage.status === "failed" && "text-red-700",
              stage.status === "pending" && "text-gray-400"
            )}
          >
            {stage.label}
          </span>
          {stage.status === "running" && (
            <span className="text-xs text-gray-500">{stage.progress}%</span>
          )}
        </div>

        {stage.status === "running" && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${stage.progress}%` }}
            />
          </div>
        )}

        {stage.status === "failed" && stage.error && (
          <p className="mt-1 text-xs text-red-600">{stage.error}</p>
        )}
      </div>
    </div>
  );
}

export function GenerationProgress(): React.ReactElement {
  const [pipelines, setPipelines] = useState<Map<string, PipelineProgress>>(
    new Map()
  );
  const [errors, setErrors] = useState<string[]>([]);

  const gatewayWsUrl = useMemo(() => {
    const base =
      process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/^http/, "ws") ??
      "ws://localhost:8000";
    return `${base}/ws/progress`;
  }, []);

  const handleMessage = useCallback((msg: WebSocketMessage) => {
    const { type, payload } = msg;

    if (type === "pipeline.progress") {
      const contentId = payload.content_id as string;
      const stageName = payload.stage as string;
      const status = payload.status as StageProgress["status"];
      const progress = (payload.progress as number) ?? 0;
      const error = (payload.error as string) ?? null;
      const title = (payload.title as string) ?? contentId;
      const estimatedTimeRemaining =
        (payload.estimated_time_remaining as number) ?? null;

      setPipelines((prev) => {
        const next = new Map(prev);
        const existing = next.get(contentId) ?? {
          contentId,
          title,
          stages: createDefaultStages(),
          estimatedTimeRemaining: null,
        };

        const updatedStages = existing.stages.map((s) =>
          s.stage === stageName
            ? {
                ...s,
                status,
                progress: status === "completed" ? 100 : progress,
                error,
                startedAt:
                  status === "running" ? new Date().toISOString() : s.startedAt,
                completedAt:
                  status === "completed" || status === "failed"
                    ? new Date().toISOString()
                    : s.completedAt,
              }
            : s
        );

        next.set(contentId, {
          ...existing,
          title,
          stages: updatedStages,
          estimatedTimeRemaining,
        });

        return next;
      });
    }

    if (type === "pipeline.error") {
      const message = (payload.message as string) ?? "Unknown error";
      setErrors((prev) => [message, ...prev.slice(0, 9)]);
    }
  }, []);

  const { isConnected } = useWebSocket({
    url: gatewayWsUrl,
    onMessage: handleMessage,
  });

  const pipelineList = Array.from(pipelines.values());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            isConnected ? "bg-green-500" : "animate-pulse bg-red-500"
          )}
        />
        <span className="text-sm text-gray-500">
          {isConnected ? "Live" : "Reconnecting..."}
        </span>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertCircle className="h-4 w-4" />
            Recent Errors
          </h4>
          <ul className="space-y-1">
            {errors.map((err, i) => (
              <li key={i} className="text-xs text-red-700">
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pipelineList.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            No active generations. Progress will appear here when content
            generation starts.
          </p>
        </div>
      ) : (
        pipelineList.map((pipeline) => (
          <div
            key={pipeline.contentId}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                {pipeline.title}
              </h3>
              {pipeline.estimatedTimeRemaining !== null && (
                <span className="text-xs text-gray-500">
                  {formatTimeRemaining(pipeline.estimatedTimeRemaining)}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {pipeline.stages.map((stage) => (
                <StageRow key={stage.stage} stage={stage} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
