"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ContentStatus } from "@/types/api";

const STATUSES: { value: ContentStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "generating", label: "Generating" },
  { value: "review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

const SORT_OPTIONS: { value: "date" | "score"; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "score", label: "Score" },
];

interface QueueFiltersProps {
  currentStatus?: ContentStatus;
  currentSort: string;
}

export function QueueFilters({
  currentStatus,
  currentSort,
}: QueueFiltersProps): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(key: string, value: string | null): void {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page"); // Reset to page 1 on filter change
    router.push(`/queue?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Status filters */}
      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => {
          const isActive =
            s.value === "all" ? !currentStatus : currentStatus === s.value;
          return (
            <button
              key={s.value}
              onClick={() => updateParams("status", s.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-gray-500">Sort by:</span>
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => updateParams("sort", s.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              currentSort === s.value
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
