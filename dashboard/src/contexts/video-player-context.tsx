"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";

interface VideoPlayerContextValue {
  seekTo: (time: number) => void;
  registerSeekTo: (fn: (time: number) => void) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

export function VideoPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [seekFn, setSeekFn] = useState<((time: number) => void) | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const registerSeekTo = useCallback((fn: (time: number) => void) => {
    setSeekFn(() => fn);
  }, []);

  const seekTo = useCallback(
    (time: number) => {
      if (seekFn) {
        seekFn(time);
      }
    },
    [seekFn]
  );

  const value = useMemo(
    () => ({ seekTo, registerSeekTo, currentTime, setCurrentTime }),
    [seekTo, registerSeekTo, currentTime, setCurrentTime]
  );

  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayer(): VideoPlayerContextValue {
  const context = useContext(VideoPlayerContext);
  if (!context) {
    throw new Error("useVideoPlayer must be used within a VideoPlayerProvider");
  }
  return context;
}
