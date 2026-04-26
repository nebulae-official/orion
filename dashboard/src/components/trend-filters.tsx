"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DATE_PRESETS = [
  { label: "Today", value: "1d" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "All time", value: "" },
];

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Used", value: "used" },
  { label: "Discarded", value: "discarded" },
  { label: "Expired", value: "expired" },
];

interface TrendFiltersProps {
  sources: string[];
}

export function TrendFilters({ sources }: TrendFiltersProps): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPeriod = searchParams.get("period") ?? "";
  const currentSources =
    searchParams.get("source")?.split(",").filter(Boolean) ?? [];
  const currentStatuses =
    searchParams.get("status")?.split(",").filter(Boolean) ?? [];

  function updateParams(updates: Record<string, string | null>): void {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.push(`/trends?${params.toString()}`);
  }

  function toggleSource(src: string): void {
    const next = currentSources.includes(src)
      ? currentSources.filter((s) => s !== src)
      : [...currentSources, src];
    updateParams({ source: next.length > 0 ? next.join(",") : null });
  }

  function toggleStatus(status: string): void {
    const next = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];
    updateParams({ status: next.length > 0 ? next.join(",") : null });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              variant={currentPeriod === preset.value ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams({ period: preset.value || null })}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {sources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sources.map((src) => {
              const isActive = currentSources.includes(src);
              return (
                <button
                  key={src}
                  onClick={() => toggleSource(src)}
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                  )}
                >
                  {src.replace("_", " ")}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        <span className="mr-1 flex items-center text-xs text-muted-foreground">Status:</span>
        {STATUS_OPTIONS.map((opt) => {
          const isActive = currentStatuses.includes(opt.value);
          return (
            <Button
              key={opt.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => toggleStatus(opt.value)}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
