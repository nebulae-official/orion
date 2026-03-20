"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useVideoPlayer } from "@/contexts/video-player-context";
import type { ScriptSegment } from "@/types/api";
import {
  Play,
  Pause,
  Maximize,
  Volume2,
  VolumeX,
  Gauge,
} from "lucide-react";

interface VideoPlayerProps {
  videoUrl?: string;
  thumbnailUrl?: string;
  segments?: ScriptSegment[];
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

export function VideoPlayer({
  videoUrl,
  thumbnailUrl,
  segments = [],
}: VideoPlayerProps): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { registerSeekTo, setCurrentTime: setContextCurrentTime } = useVideoPlayer();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [activeSegment, setActiveSegment] = useState<ScriptSegment | null>(null);

  const togglePlay = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const setSpeed = useCallback((speed: number): void => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  }, []);

  const seekTo = useCallback((time: number): void => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
    setContextCurrentTime(time);
  }, [setContextCurrentTime]);

  // Register seekTo with context so other components can use it
  useEffect(() => {
    registerSeekTo(seekTo);
  }, [registerSeekTo, seekTo]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = x / rect.width;
      seekTo(percent * duration);
    },
    [duration, seekTo]
  );

  const toggleFullscreen = useCallback((): void => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = (): void => {
      setCurrentTime(video.currentTime);
      setContextCurrentTime(video.currentTime);
    };
    const onLoadedMetadata = (): void => {
      setDuration(video.duration);
    };
    const onEnded = (): void => {
      setIsPlaying(false);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("ended", onEnded);
    };
  }, [setContextCurrentTime]);

  // Track active script segment
  useEffect(() => {
    if (segments.length === 0) return;
    const active = segments.find(
      (s) => currentTime >= s.start_time && currentTime <= s.end_time
    );
    setActiveSegment(active ?? null);
  }, [currentTime, segments]);

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!videoUrl) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-surface">
        <div className="text-center">
          <Play className="mx-auto h-12 w-12 text-text-dim" />
          <p className="mt-2 text-sm text-text-muted">No video available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="group relative overflow-hidden rounded-xl border border-border bg-black"
    >
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl}
        className="aspect-video w-full cursor-pointer"
        onClick={togglePlay}
        playsInline
      />

      {/* Script overlay */}
      {activeSegment && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-black/70 px-4 py-2">
          <p className="text-center text-sm text-white">
            {activeSegment.text}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
        {/* Progress bar */}
        <div
          className="mb-3 h-1.5 cursor-pointer rounded-full bg-white/30"
          onClick={handleProgressClick}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"} className="text-white hover:text-primary-light">
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </button>

          <button onClick={toggleMute} aria-label={isMuted ? "Unmute" : "Mute"} className="text-white hover:text-primary-light">
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>

          <span className="text-xs text-white/80">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="ml-auto flex items-center gap-3">
            {/* Speed control */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                aria-label={`Playback speed ${playbackSpeed}x`}
                aria-expanded={showSpeedMenu}
                className="flex items-center gap-1 text-sm text-white hover:text-primary-light"
              >
                <Gauge className="h-4 w-4" />
                {playbackSpeed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-8 right-0 rounded-lg border border-border bg-surface-elevated p-1 shadow-lg">
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setSpeed(speed)}
                      className={cn(
                        "block w-full rounded px-3 py-1 text-left text-sm",
                        playbackSpeed === speed
                          ? "bg-primary text-white"
                          : "text-text-secondary hover:bg-surface-hover"
                      )}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
              className="text-white hover:text-primary-light"
            >
              <Maximize className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
