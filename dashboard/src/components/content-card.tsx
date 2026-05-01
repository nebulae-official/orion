import Link from "next/link";
import Image from "next/image";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Content, ContentStatus } from "@/types/api";
import {
  Play,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Sparkles,
} from "lucide-react";

const STATUS_CONFIG: Record<
  ContentStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Draft",
    className:
      "bg-surface-elevated text-text-secondary border border-border",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  generating: {
    label: "Generating",
    className: "bg-primary-surface text-primary-light",
    icon: <Sparkles className="h-3.5 w-3.5" />,
  },
  review: {
    label: "In Review",
    className: "bg-warning-surface text-warning-light",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  approved: {
    label: "Approved",
    className: "bg-success-surface text-success-light",
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  published: {
    label: "Published",
    className: "bg-info-surface text-info-light",
    icon: <Send className="h-3.5 w-3.5" />,
  },
  rejected: {
    label: "Rejected",
    className: "bg-danger-surface text-danger-light",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

// Per-status gradient backgrounds for thumbnails without a real image,
// matching the HTML reference color palette.
const THUMB_GRADIENT: Partial<Record<ContentStatus, string>> = {
  approved:
    "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(6,182,212,0.12))",
  generating:
    "linear-gradient(135deg, rgba(139,92,246,0.14), rgba(34,211,238,0.10))",
  draft:
    "linear-gradient(135deg, rgba(34,211,238,0.10), rgba(124,58,237,0.08))",
  published:
    "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(6,182,212,0.08))",
};

export function ContentCard({
  content,
}: {
  content: Content;
}): React.ReactElement {
  const statusConfig = STATUS_CONFIG[content.status];
  const thumbGradient = THUMB_GRADIENT[content.status];

  return (
    <Link
      href={`/queue/${content.id}`}
      className="group block glass-card luminous-border rounded-xl shadow-sm transition-all duration-300 hover:scale-[1.01]"
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-surface-elevated"
        style={thumbGradient ? { background: thumbGradient } : undefined}
      >
        {content.thumbnail_url ? (
          <Image
            src={content.thumbnail_url}
            alt={content.title}
            width={400}
            height={225}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-7 w-7 text-text-dim opacity-60" />
          </div>
        )}
        {content.video_url && content.thumbnail_url && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <Play className="h-8 w-8 text-white opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              statusConfig.className
            )}
          >
            {statusConfig.icon}
            {statusConfig.label}
          </span>
          {content.confidence_score !== undefined && (
            <span className="text-[11px] text-text-dim">
              {Math.round(content.confidence_score * 100)}% conf.
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 text-[13.5px] font-medium leading-snug text-text">
          {content.title}
        </h3>

        <div className="mt-2 font-mono text-[11px] text-text-dim">
          orion.trend.detected · {formatRelativeTime(content.created_at)}
        </div>
      </div>
    </Link>
  );
}

export function ContentCardSkeleton(): React.ReactElement {
  return (
    <div className="animate-pulse glass-card luminous-border rounded-xl shadow-sm">
      <div className="aspect-video w-full rounded-t-xl bg-surface-elevated" />
      <div className="p-4">
        <div className="mb-2 h-5 w-20 rounded-full bg-surface-elevated" />
        <div className="h-4 w-3/4 rounded bg-surface-elevated" />
        <div className="mt-2 h-3 w-40 rounded bg-surface-elevated" />
      </div>
    </div>
  );
}
