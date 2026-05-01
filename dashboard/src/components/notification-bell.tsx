"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { useWebSocket, type WebSocketMessage } from "@/hooks/use-websocket";
import { NotificationCenter } from "./notification-center";

interface NotificationBellProps {
  initialCount: number;
  wsUrl: string;
}

export function NotificationBell({
  initialCount,
  wsUrl,
}: NotificationBellProps): React.ReactElement {
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setUnreadCount(initialCount);
  }, [initialCount]);

  const handleMessage = useCallback((msg: WebSocketMessage) => {
    if (msg.type === "notification") {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  useWebSocket({ url: wsUrl, onMessage: handleMessage });

  const displayCount = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative transition-colors hover:text-violet-300"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 py-0.5 text-[10px] font-bold leading-none text-white">
              {displayCount}
            </span>
          </span>
        )}
      </button>
      {isOpen && (
        <NotificationCenter
          onClose={() => setIsOpen(false)}
          onCountChange={setUnreadCount}
        />
      )}
    </div>
  );
}
