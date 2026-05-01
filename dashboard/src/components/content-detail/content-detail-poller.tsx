"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ContentDetailPollerProps {
  isGenerating: boolean;
}

export function ContentDetailPoller({
  isGenerating,
}: ContentDetailPollerProps): null {
  const router = useRouter();

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 10_000);
    return () => clearInterval(interval);
  }, [isGenerating, router]);

  return null;
}
