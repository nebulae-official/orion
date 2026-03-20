"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ContentStatus } from "@/types/api";
import { Button } from "@/components/ui/button";

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
    params.delete("page");
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
            <Button
              key={s.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams("status", s.value)}
            >
              {s.label}
            </Button>
          );
        })}
      </div>

      {/* Sort */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-text-muted">Sort by:</span>
        {SORT_OPTIONS.map((s) => (
          <Button
            key={s.value}
            variant={currentSort === s.value ? "default" : "outline"}
            size="sm"
            onClick={() => updateParams("sort", s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
