"use client";

import { useState } from "react";

interface Trend {
  id: string;
  topic: string;
  source: string;
  virality_score: number;
  status: string;
  created_at: string;
}

interface TrendTableProps {
  trends: Trend[];
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-info-surface text-info-light",
  PROCESSING: "bg-warning-surface text-warning-light",
  USED: "bg-success-surface text-success-light",
  DISCARDED: "bg-surface-elevated text-text-muted",
};

type SortKey = "topic" | "source" | "virality_score" | "status" | "created_at";

const COLUMN_LABELS: Record<SortKey, string> = {
  topic: "Topic",
  source: "Source",
  virality_score: "Virality",
  status: "Status",
  created_at: "Created",
};

export function TrendTable({ trends }: TrendTableProps): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...trends].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
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

  if (trends.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center text-text-muted">
        No trends found. Scout may not be running.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface-elevated">
          <tr>
            {(Object.keys(COLUMN_LABELS) as SortKey[]).map((key) => (
              <th
                key={key}
                onClick={() => toggleSort(key)}
                className="cursor-pointer px-4 py-3 font-medium text-text-muted hover:text-text"
              >
                {COLUMN_LABELS[key]}
                {sortKey === key && (sortDir === "asc" ? " \u2191" : " \u2193")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((trend) => (
            <tr key={trend.id} className="hover:bg-surface-hover">
              <td className="px-4 py-3 font-medium text-text">
                {trend.topic}
              </td>
              <td className="px-4 py-3 text-text-secondary">{trend.source}</td>
              <td className="px-4 py-3 text-text-secondary">
                {trend.virality_score.toFixed(1)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[trend.status] ?? "bg-surface-elevated text-text-muted"}`}
                >
                  {trend.status}
                </span>
              </td>
              <td className="px-4 py-3 text-text-muted">
                {new Date(trend.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
