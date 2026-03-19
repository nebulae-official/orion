"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 3_000;

interface VideoPollerProps {
  hasActiveRenders: boolean;
}

export function VideoPoller({
  hasActiveRenders,
}: VideoPollerProps): React.ReactElement | null {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!hasActiveRenders) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasActiveRenders, router]);

  if (!hasActiveRenders) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Auto-refreshing every 3s</span>
    </div>
  );
}
