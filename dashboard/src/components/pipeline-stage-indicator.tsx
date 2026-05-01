import {
  Search,
  MessageSquare,
  FileText,
  Palette,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Content } from "@/types/api";
import type { PipelineRun } from "@/lib/demo-data";

export const PIPELINE_STAGES = [
  { key: "analyst", label: "Analyst", icon: Search },
  { key: "critique", label: "Critique", icon: MessageSquare },
  { key: "script", label: "Script", icon: FileText },
  { key: "visuals", label: "Visual Prompts", icon: Palette },
  { key: "done", label: "Done", icon: CheckCircle2 },
] as const;

export type PipelineStageStatus = "completed" | "running" | "pending" | "failed";

export function stageStatusForContent(
  content: Content,
  pipelineRun: PipelineRun | undefined,
  stageIndex: number,
): PipelineStageStatus {
  if (content.status === "rejected" || pipelineRun?.status === "failed") {
    const failedAt = pipelineRun?.stages_completed ?? 0;
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
    const displayCompleted = Math.floor(
      (pipelineRun.stages_completed / pipelineRun.stages_total) * PIPELINE_STAGES.length,
    );
    if (stageIndex < displayCompleted) return "completed";
    if (stageIndex === displayCompleted) return "running";
    return "pending";
  }

  return "pending";
}

interface PipelineStageIndicatorProps {
  content: Content;
  pipelineRun: PipelineRun | undefined;
  size?: "sm" | "lg";
}

export function PipelineStageIndicator({
  content,
  pipelineRun,
  size = "sm",
}: PipelineStageIndicatorProps): React.ReactElement {
  const circleSize = size === "lg" ? "h-9 w-9" : "h-7 w-7";
  const iconSize = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  const connectorW = size === "lg" ? "w-8 sm:w-12" : "w-6 sm:w-8";
  const itemW = size === "lg" ? "w-16" : "w-11";
  const labelSize = size === "lg" ? "text-xs" : "text-[10px]";
  const connectorHeight = size === "lg" ? "h-9" : "h-7";

  return (
    <div className="flex items-start gap-0">
      {PIPELINE_STAGES.map((stage, idx) => {
        const status = stageStatusForContent(content, pipelineRun, idx);
        const Icon = stage.icon;

        return (
          <div key={stage.key} className="flex items-start">
            {idx > 0 && (
              <div className={cn("flex items-center", connectorHeight)}>
                <div
                  className={cn(
                    "h-0.5",
                    connectorW,
                    status === "completed" && "bg-success-light/50",
                    status === "running" && "bg-primary-light/50",
                    status === "failed" && "bg-danger-light/50",
                    status === "pending" && "bg-border",
                  )}
                />
              </div>
            )}

            <div className={cn("flex flex-col items-center gap-1", itemW)}>
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full transition-colors",
                  circleSize,
                  status === "completed" && "bg-success-surface text-success-light",
                  status === "running" && "bg-primary-surface text-primary-light",
                  status === "failed" && "bg-danger-surface text-danger-light",
                  status === "pending" && "bg-surface-elevated text-text-dim",
                )}
                title={`${stage.label}: ${status}`}
              >
                {status === "completed" ? (
                  <CheckCircle2 className={iconSize} />
                ) : status === "running" ? (
                  <Loader2 className={cn(iconSize, "animate-spin")} />
                ) : status === "failed" ? (
                  <XCircle className={iconSize} />
                ) : (
                  <Icon className={iconSize} />
                )}
              </div>
              <span
                className={cn(
                  "w-full text-center leading-tight",
                  labelSize,
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
