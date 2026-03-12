"use client";

import { cn } from "@/lib/utils";
import type { ScriptSegment } from "@/types/api";

interface ScriptPanelProps {
  script?: string;
  segments?: ScriptSegment[];
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function seekTo(time: number): void {
  const fn = (window as unknown as Record<string, unknown>).__orionSeekTo;
  if (typeof fn === "function") {
    (fn as (t: number) => void)(time);
  }
}

export function ScriptPanel({
  script,
  segments = [],
}: ScriptPanelProps): React.ReactElement {
  if (!script && segments.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Script</h2>
        <p className="mt-2 text-sm text-gray-400">No script available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Script</h2>
      </div>

      <div className="max-h-[500px] overflow-y-auto p-6">
        {segments.length > 0 ? (
          <div className="space-y-3">
            {segments.map((segment) => (
              <button
                key={segment.id}
                onClick={() => seekTo(segment.start_time)}
                className="group block w-full rounded-lg p-3 text-left transition-colors hover:bg-blue-50"
              >
                <div className="mb-1 text-xs font-medium text-blue-600">
                  {formatTimestamp(segment.start_time)} -{" "}
                  {formatTimestamp(segment.end_time)}
                </div>
                <p className="text-sm text-gray-700 group-hover:text-gray-900">
                  {segment.text}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-gray-600">{script}</p>
        )}
      </div>
    </div>
  );
}
