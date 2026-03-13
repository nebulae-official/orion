"use client";

import type { ScriptSegment } from "@/types/api";
import { useVideoPlayer } from "@/contexts/video-player-context";

interface ScriptPanelProps {
  script?: string;
  segments?: ScriptSegment[];
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ScriptPanel({
  script,
  segments = [],
}: ScriptPanelProps): React.ReactElement {
  const { seekTo } = useVideoPlayer();

  if (!script && segments.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text">Script</h2>
        <p className="mt-2 text-sm text-text-dim">No script available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-text">Script</h2>
      </div>

      <div className="max-h-[500px] overflow-y-auto p-6">
        {segments.length > 0 ? (
          <div className="space-y-3">
            {segments.map((segment) => (
              <button
                key={segment.id}
                onClick={() => seekTo(segment.start_time)}
                className="group block w-full rounded-lg p-3 text-left transition-colors hover:bg-primary-surface"
              >
                <div className="mb-1 text-xs font-medium text-primary-light">
                  {formatTimestamp(segment.start_time)} -{" "}
                  {formatTimestamp(segment.end_time)}
                </div>
                <p className="text-sm text-text-secondary group-hover:text-text">
                  {segment.text}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-text-secondary">{script}</p>
        )}
      </div>
    </div>
  );
}
