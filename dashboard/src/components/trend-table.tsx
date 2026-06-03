"use client";

import { useMemo, useState } from "react";
import { Radio, Rss, Search, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trend } from "@/types/api";

interface TrendTableProps {
  trends: Trend[];
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-info-surface text-info-light",
  PROCESSING: "bg-warning-surface text-warning-light",
  USED: "bg-success-surface text-success-light",
  DISCARDED: "border border-border bg-surface-elevated text-text-muted",
};

type SortKey = "topic" | "source" | "virality_score" | "status" | "detected_at";

const COLUMN_LABELS: Record<SortKey, string> = {
  topic: "Topic",
  source: "Source",
  virality_score: "Virality",
  status: "Status",
  detected_at: "Detected",
};

const TOP_SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "virality_score", label: "Virality" },
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
  { key: "detected_at", label: "Time" },
];

function trendTime(trend: Trend): string {
  return trend.detected_at ?? trend.created_at;
}

function trendScore(trend: Trend): number {
  return trend.score ?? trend.virality_score ?? 0;
}

function sortValue(trend: Trend, key: SortKey): string | number {
  if (key === "detected_at") {
    return trendTime(trend);
  }
  if (key === "virality_score") {
    return trendScore(trend);
  }
  return trend[key as keyof Trend] as string | number;
}

function formatScore(score: number): string {
  const normalized = score <= 1 ? score * 10 : score;
  return normalized.toFixed(1);
}

function scorePercent(score: number): number {
  const normalized = score <= 1 ? score * 100 : score * 10;
  return Math.max(0, Math.min(100, normalized));
}

function formatSource(source: string): string {
  const normalized = source.toLowerCase();
  if (normalized.includes("twitter") || normalized === "x") return "Twitter";
  if (normalized.includes("rss")) return "RSS";
  if (normalized.includes("google")) return "Google Trends";
  if (normalized === "news_api" || normalized === "newsapi") return "News API";
  return source.replaceAll("_", " ");
}

function SourceIcon({ source }: { source: string }): React.ReactElement {
  const normalized = source.toLowerCase();
  if (normalized.includes("twitter") || normalized === "x") {
    return <Twitter className="h-3.5 w-3.5" />;
  }
  if (normalized.includes("rss") || normalized.includes("news")) {
    return <Rss className="h-3.5 w-3.5" />;
  }
  return <Radio className="h-3.5 w-3.5" />;
}

function nicheLabel(trend: Trend): string {
  if (!trend.keywords || trend.keywords.length === 0) return "General";
  return trend.keywords.slice(0, 2).map((keyword) => keyword.replaceAll("_", " ")).join(" / ");
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function TrendTable({ trends }: TrendTableProps): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>("detected_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const sources = useMemo(
    () => Array.from(new Set(trends.map((trend) => trend.source))).sort(),
    [trends],
  );
  const statuses = useMemo(
    () => Array.from(new Set(trends.map((trend) => trend.status))).sort(),
    [trends],
  );

  const filtered = trends.filter((trend) => {
    const matchesSource = sourceFilter === "all" || trend.source === sourceFilter;
    const matchesStatus = statusFilter === "all" || trend.status === statusFilter;
    return matchesSource && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = sortValue(a, sortKey);
    const bVal = sortValue(b, sortKey);
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  function toggleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  if (trends.length === 0) {
    return (
      <div className="glass-card luminous-border rounded-xl p-12 text-center text-text-muted">
        No trends found. Scout may not be running.
      </div>
    );
  }

  return (
    <section className="glass-card luminous-border overflow-hidden rounded-xl">
      <div className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="font-[family-name:var(--font-label)] text-[10px] font-medium uppercase tracking-[0.2em] text-primary-light">
            Scout
          </div>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-base font-semibold tracking-[-0.01em] text-text">
            Detected Trends
          </h2>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TOP_SORTS.map((sort) => (
            <button
              key={sort.key}
              type="button"
              onClick={() => toggleSort(sort.key)}
              className={cn(
                "rounded-lg px-3 py-2 font-[family-name:var(--font-label)] text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:bg-white/[0.05] hover:text-primary-light",
                sortKey === sort.key && "bg-primary-surface text-primary-light",
              )}
            >
              {sort.label}
              {sortIndicator(sort.key)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-white/[0.06] bg-surface-elevated/20 px-5 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Search className="h-3.5 w-3.5 text-cyan-light" />
          <span className="font-[family-name:var(--font-label)] uppercase tracking-[0.18em]">
            Discovery Filters
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filter trends by source"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="rounded-lg border border-white/[0.08] bg-surface-elevated px-3 py-2 text-xs text-text-secondary outline-none transition-colors hover:border-white/[0.14] focus:border-primary"
          >
            <option value="all">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {formatSource(source)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter trends by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-white/[0.08] bg-surface-elevated px-3 py-2 text-xs text-text-secondary outline-none transition-colors hover:border-white/[0.14] focus:border-primary"
          >
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-text-muted">
          No trends match the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="px-3 py-2.5 first:pl-5">
                  <button
                    type="button"
                    onClick={() => toggleSort("topic")}
                    className="font-[family-name:var(--font-label)] text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text"
                  >
                    {COLUMN_LABELS.topic}
                    {sortIndicator("topic")}
                  </button>
                </th>
                {(["source", "virality_score", "status"] as SortKey[]).map((key) => (
                  <th key={key} className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="font-[family-name:var(--font-label)] text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text"
                    >
                      {COLUMN_LABELS[key]}
                      {sortIndicator(key)}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2.5">
                  <span className="font-[family-name:var(--font-label)] text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
                    Niche
                  </span>
                </th>
                <th className="px-3 py-2.5 pr-5">
                  <button
                    type="button"
                    onClick={() => toggleSort("detected_at")}
                    className="font-[family-name:var(--font-label)] text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted transition-colors hover:text-text"
                  >
                    {COLUMN_LABELS.detected_at}
                    {sortIndicator("detected_at")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {sorted.map((trend) => {
                const percent = scorePercent(trendScore(trend));
                const lowScore = percent < 50;

                return (
                  <tr key={trend.id} className="transition-colors hover:bg-white/[0.035]">
                    <td className="px-3 py-3.5 pl-5 align-middle">
                      <div className="font-medium text-text">{trend.topic}</div>
                      <div className="mt-1 font-mono text-[11px] text-text-muted">
                        orion.trend.detected
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
                        <SourceIcon source={trend.source} />
                        {formatSource(trend.source)}
                      </span>
                    </td>
                    <td className="w-32 px-3 py-3.5 align-middle">
                      <div className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.02em] text-text">
                        {formatScore(trendScore(trend))}
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            lowScore ? "bg-warning" : "bg-gradient-to-r from-primary to-cyan-light",
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
                          STATUS_COLORS[trend.status] ?? "border border-border bg-surface-elevated text-text-muted",
                        )}
                      >
                        {trend.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <span className="inline-flex max-w-[180px] items-center truncate rounded-full bg-primary-surface px-2.5 py-1 text-[11px] font-medium capitalize text-primary-light">
                        {nicheLabel(trend)}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 pr-5 align-middle font-mono text-xs text-text-muted">
                      {formatRelativeTime(trendTime(trend))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
