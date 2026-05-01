"use client";

import { useState } from "react";
import { Clipboard, Check } from "lucide-react";
import { useVideoPlayer } from "@/contexts/video-player-context";
import type { ScriptSegment } from "@/types/api";
import { Button } from "@/components/ui/button";

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ContentScriptSectionProps {
  script?: string;
  segments: ScriptSegment[];
}

export function ContentScriptSection({
  script,
  segments,
}: ContentScriptSectionProps): React.ReactElement {
  const { seekTo } = useVideoPlayer();
  const [copied, setCopied] = useState(false);

  const wordCount = script
    ? script.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const handleCopy = async () => {
    if (!script) return;
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-text">Script</h2>
          {wordCount > 0 && (
            <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-muted">
              {wordCount.toLocaleString()} words
            </span>
          )}
        </div>
        {script && (
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-4 w-4 text-success" />
                Copied!
              </>
            ) : (
              <>
                <Clipboard className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto p-6">
        {!script && segments.length === 0 ? (
          <p className="text-sm text-text-dim">No script available yet.</p>
        ) : segments.length > 0 ? (
          <div className="space-y-3">
            {segments.map((segment) => (
              <button
                key={segment.id}
                onClick={() => seekTo(segment.start_time)}
                className="group block w-full rounded-lg p-3 text-left transition-colors hover:bg-primary-surface"
              >
                <div className="mb-1 text-xs font-medium text-primary-light">
                  {formatTimestamp(segment.start_time)} —{" "}
                  {formatTimestamp(segment.end_time)}
                </div>
                <p className="text-sm text-text-secondary group-hover:text-text">
                  {segment.text}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-secondary">
            {script}
          </p>
        )}
      </div>
    </>
  );
}
