"use client";

import { useState, useEffect, useRef } from "react";
import { Check, CheckCheck, X } from "lucide-react";
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

export function NotificationCenter({
  onClose,
  onCountChange,
}: NotificationCenterProps): React.ReactElement {
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

  // Close on outside click
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
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      onCountChange(
        notifications.filter((n) => !n.is_read && n.id !== id).length
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

  const formatTime = (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-96 max-h-[32rem] overflow-y-auto rounded-xl border border-white/10 bg-[var(--ds-surface-container)] shadow-xl z-50"
    >
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllRead}
            title="Mark all read"
            className="hover:text-violet-300 transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="hover:text-violet-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {loading && (
          <div className="p-4 text-center text-sm text-text-muted">
            Loading...
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="p-4 text-center text-sm text-text-muted">
            No notifications yet.
          </div>
        )}

        {notifications.map((n) => (
          <div
            key={n.id}
            className={`p-4 ${!n.is_read ? "bg-[var(--ds-primary-container)]/5" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && (
                  <p className="text-xs text-text-muted mt-1">{n.body}</p>
                )}
                <p className="text-[10px] text-text-muted mt-1">
                  {formatTime(n.created_at)}
                </p>
              </div>
              {!n.is_read && (
                <button
                  onClick={() => markRead(n.id)}
                  title="Mark read"
                  className="ml-2 hover:text-violet-300 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
