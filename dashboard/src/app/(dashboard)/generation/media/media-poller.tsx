"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Invisible client component that polls every 5 seconds by calling
 * `router.refresh()` to re-fetch server data while batches are running.
 */
export function MediaPoller(): null {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 5_000);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
