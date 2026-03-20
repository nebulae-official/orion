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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hover:text-violet-300 transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
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
