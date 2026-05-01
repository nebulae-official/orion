"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ContentStatus } from "@/types/api";

const STATUSES: { value: ContentStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "generating", label: "Generating" },
  { value: "rejected", label: "Rejected" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

type StatusCounts = Partial<Record<ContentStatus | "all", number>>;

interface QueueFiltersProps {
  currentStatus?: ContentStatus;
  currentSort: string;
  statusCounts?: StatusCounts;
}

export function QueueFilters({
  currentStatus,
  currentSort,
  statusCounts,
}: QueueFiltersProps): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null): void {
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 select-none font-[family-name:var(--font-display)] text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
        Filter
      </span>

      {STATUSES.map((s) => {
        const isActive =
          s.value === "all" ? !currentStatus : currentStatus === s.value;
        const count = statusCounts?.[s.value];
        return (
          <button
            key={s.value}
            onClick={() => updateParam("status", s.value)}
            className={[
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5",
              "font-[family-name:var(--font-display)] text-[11px] font-medium tracking-[0.12em]",
              "transition-all duration-200",
              isActive
                ? "border-primary bg-primary-surface text-primary-light"
                : "border-border bg-transparent text-text-secondary hover:border-border-light hover:text-text",
            ].join(" ")}
          >
            {s.label}
            {count !== undefined && (
              <span className="opacity-60">{count}</span>
            )}
          </button>
        );
      })}

      <div className="ml-auto">
        <button
          onClick={() =>
            updateParam("sort", currentSort === "score" ? "date" : "score")
          }
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 font-[family-name:var(--font-display)] text-[12px] font-medium text-text-secondary transition-all duration-200 hover:border-border-light hover:text-text"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            stroke="currentColor"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M7 12h10" />
            <path d="M10 18h4" />
          </svg>
          {currentSort === "score" ? "Score" : "Date"}
        </button>
      </div>
    </div>
  );
}
