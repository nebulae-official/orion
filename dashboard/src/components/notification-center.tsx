"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCheck,
  X,
  Check,
  Bell,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  FileText,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notification-actions";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface NotificationCenterProps {
  onClose: () => void;
  onCountChange: (count: number) => void;
}

const EVENT_CONFIG: Record<
  string,
  { icon: React.ReactNode; colorClass: string; label: string }
> = {
  "trend.detected": {
    icon: <TrendingUp className="h-4 w-4" />,
    colorClass: "bg-cyan-surface text-cyan",
    label: "Trend Detected",
  },
  "content.published": {
    icon: <CheckCircle2 className="h-4 w-4" />,
    colorClass: "bg-success-surface text-success",
    label: "Content Published",
  },
  "content.rejected": {
    icon: <XCircle className="h-4 w-4" />,
    colorClass: "bg-danger-surface text-danger",
    label: "Content Rejected",
  },
  "media.failed": {
    icon: <AlertCircle className="h-4 w-4" />,
    colorClass: "bg-warning-surface text-warning",
    label: "Media Failed",
  },
  "pipeline.stage_changed": {
    icon: <Sparkles className="h-4 w-4" />,
    colorClass: "bg-primary-surface text-primary-light",
    label: "Pipeline Update",
  },
  "content.created": {
    icon: <FileText className="h-4 w-4" />,
    colorClass: "bg-surface-elevated text-text-secondary",
    label: "Content Created",
  },
};

function getNavTarget(n: Notification): string | null {
  const contentId = n.metadata?.content_id as string | undefined;
  switch (n.type) {
    case "content.published":
    case "content.rejected":
    case "content.created":
    case "pipeline.stage_changed":
      return contentId ? `/queue/${contentId}` : "/queue";
    case "trend.detected":
      return "/trends";
    case "media.failed":
      return "/generation";
    default:
      return null;
  }
}

export function NotificationCenter({
  onClose,
  onCountChange,
}: NotificationCenterProps): React.ReactElement {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications().then((data) => {
      if (data) {
        setNotifications(data.items);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const markRead = async (id: string) => {
    const result = await markNotificationRead(id);
    if (result?.status === "ok") {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      onCountChange(
        notifications.filter((n) => !n.is_read && n.id !== id).length,
      );
    }
  };

  const markAllRead = async () => {
    const result = await markAllNotificationsRead();
    if (result?.status === "ok") {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      onCountChange(0);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      await markRead(n.id);
    }
    const target = getNavTarget(n);
    if (target) {
      router.push(target);
      onClose();
    }
  };

  return (
    <div
      ref={panelRef}
      className="glass-card absolute right-0 top-full z-50 mt-2 flex max-h-[32rem] w-96 flex-col overflow-hidden rounded-xl shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text">Notifications</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllRead}
            title="Mark all read"
            className="text-text-muted transition-colors hover:text-primary-light"
          >
            <CheckCheck className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="text-text-muted transition-colors hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60">
        {loading && (
          <div className="p-4 text-center text-sm text-text-muted">
            Loading...
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <Bell className="mb-3 h-8 w-8 text-text-dim" />
            <p className="text-sm font-medium text-text-muted">No notifications yet</p>
            <p className="mt-1 text-xs text-text-dim">
              Events from the pipeline will appear here.
            </p>
          </div>
        )}

        {notifications.map((n) => {
          const config = EVENT_CONFIG[n.type];
          const isClickable = Boolean(getNavTarget(n));

          return (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3 transition-colors",
                !n.is_read && "bg-surface-hover/40",
                isClickable && "cursor-pointer hover:bg-primary-surface/20",
              )}
              onClick={() => void handleNotificationClick(n)}
            >
              {/* Event icon */}
              {config ? (
                <div
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    config.colorClass,
                  )}
                >
                  {config.icon}
                </div>
              ) : (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-text-secondary">
                  <Bell className="h-4 w-4" />
                </div>
              )}

              {/* Text */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text leading-tight">
                  {n.title}
                </p>
                {n.body && (
                  <p className="mt-0.5 text-xs text-text-muted line-clamp-2">
                    {n.body}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-text-dim">
                  {formatRelativeTime(n.created_at)}
                </p>
              </div>

              {/* Unread indicator / mark-read button */}
              {!n.is_read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void markRead(n.id);
                  }}
                  title="Mark read"
                  className="ml-1 mt-0.5 shrink-0 text-text-dim transition-colors hover:text-primary-light"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
