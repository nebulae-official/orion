import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Send } from "lucide-react";
import { serverFetch } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";
import { demoPublishRecords, demoContent } from "@/lib/demo-data";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatRelativeTime } from "@/lib/utils";
import { GenerationCard, GenerationEyebrow } from "@/components/generation-ui-kit";
import {
  GhostButton,
  PlatformBadge,
  PlatformSummaryCard,
  PublishStatusBadge,
} from "@/components/publishing-ui-kit";
import type { PublishRecord } from "@/types/api";

// ── Platform card configuration (matches HTML reference colors exactly) ────────

const PLATFORM_CARDS = [
  {
    key: "twitter",
    label: "Twitter / X",
    icon: "𝕏",
    iconStyle: {
      background: "rgba(0,0,0,0.4)",
      border: "1px solid rgba(255,255,255,0.12)",
    },
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: "▶",
    iconStyle: {
      background: "rgba(255,0,0,0.15)",
      border: "1px solid rgba(255,0,0,0.2)",
    },
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: "♪",
    iconStyle: {
      background: "rgba(0,0,0,0.35)",
      border: "1px solid rgba(255,255,255,0.10)",
    },
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: "in",
    iconStyle: {
      background: "rgba(10,102,194,0.15)",
      border: "1px solid rgba(10,102,194,0.25)",
    },
  },
] as const;

// ── Table column labels ────────────────────────────────────────────────────────

const TABLE_COLS = ["Content", "Platform", "Status", "Published", "Cost"] as const;

// ── Demo cost per publish (derived from platform baseline) ────────────────────

const PLATFORM_COSTS: Record<string, number> = {
  youtube: 0.38,
  twitter: 0.42,
  tiktok: 0.31,
  instagram: 0.35,
  linkedin: 0.45,
};

function demoCostLabel(record: PublishRecord): string {
  if (record.status === "failed") return "$0.00";
  if (record.status !== "published") return "—";
  const base = PLATFORM_COSTS[record.platform] ?? 0.35;
  return `$${base.toFixed(2)}`;
}

// ── Status resolution: distinguish "Live" (<1h) from "Published" ──────────────

type PublishVariant = "live" | "published" | "scheduled" | "failed";

function resolveVariant(record: PublishRecord): PublishVariant {
  if (record.status === "failed") return "failed";
  if (record.status === "pending") return "scheduled";
  if (record.published_at) {
    const ageMs = Date.now() - new Date(record.published_at).getTime();
    if (ageMs < 60 * 60 * 1000) return "live";
  }
  return "published";
}

// ── Platform stats: derive published + queued counts from records ─────────────

interface PlatformStats {
  published: number;
  queued: number;
  connected: boolean;
}

function computePlatformStats(
  records: PublishRecord[],
): Record<string, PlatformStats> {
  const stats: Record<string, PlatformStats> = {};
  for (const r of records) {
    if (!stats[r.platform]) {
      stats[r.platform] = { published: 0, queued: 0, connected: true };
    }
    if (r.status === "published") stats[r.platform].published++;
    else if (r.status === "pending") stats[r.platform].queued++;
  }
  return stats;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PublishingPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token && !DEMO_MODE) {
    redirect("/login");
  }

  let records: PublishRecord[] = [];
  let fetchError = false;

  if (DEMO_MODE) {
    records = demoPublishRecords;
  } else {
    try {
      records = await serverFetch<PublishRecord[]>(
        "/api/v1/publisher/publish/history?limit=100",
        {},
        token,
      );
    } catch {
      fetchError = true;
    }
  }

  // Content title lookup — used in demo mode only.
  const contentTitles = new Map<string, string>(
    demoContent.map((c) => [c.id, c.title]),
  );

  const platformStats = computePlatformStats(records);

  return (
    <div className="px-5 py-7 sm:px-8 lg:px-11 lg:py-9">
      {/* ── Page header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary-light/35 bg-gradient-to-br from-primary/30 to-cyan/25 text-primary-light shadow-[0_8px_24px_-8px_rgba(124,58,237,0.45)]">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">
              Publishing
            </h1>
            <p className="mt-1 text-text-secondary">
              Platform connections, publish history and scheduled posts.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {fetchError && (
          <div className="rounded-xl border border-warning-surface bg-warning-surface/30 p-4 text-sm text-warning-light">
            Unable to load publishing history. Services may not be running.
          </div>
        )}

        {/* ── Platform summary ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLATFORM_CARDS.map(({ key, label, icon, iconStyle }) => {
            const stats = platformStats[key] ?? {
              published: 0,
              queued: 0,
              connected: false,
            };
            return (
              <PlatformSummaryCard
                key={key}
                label={label}
                icon={icon}
                iconStyle={iconStyle}
                published={stats.published}
                queued={stats.queued}
                connected={stats.connected}
              />
            );
          })}
        </div>

        {/* ── Publish history ── */}
        {records.length === 0 ? (
          <EmptyState
            icon={<Send className="h-7 w-7" />}
            title="Nothing published yet"
            description="Approved content will be posted automatically and appear here once published."
            action={{ label: "Review Queue", href: "/queue" }}
          />
        ) : (
          <GenerationCard className="overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6">
              <div>
                <GenerationEyebrow className="mb-1">Publisher</GenerationEyebrow>
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                  Publish History
                </h2>
              </div>
              <GhostButton>Export CSV</GhostButton>
            </div>

            {/* History table */}
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-surface-elevated/30">
                    {TABLE_COLS.map((col) => (
                      <th
                        key={col}
                        className={cn(
                          "px-5 py-3 font-[family-name:var(--font-label)] text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted",
                          col === "Cost" ? "text-right" : "text-left",
                        )}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {records.map((record) => {
                    const title = DEMO_MODE
                      ? (contentTitles.get(record.content_id) ??
                          `${record.content_id.slice(0, 12)}…`)
                      : `${record.content_id.slice(0, 12)}…`;
                    const variant = resolveVariant(record);
                    const cost = DEMO_MODE ? demoCostLabel(record) : "—";

                    return (
                      <tr
                        key={record.id}
                        className="transition-colors hover:bg-surface-hover/40"
                      >
                        {/* Content title + job ID */}
                        <td className="px-5 py-4">
                          <div className="text-[13.5px] font-medium text-text">
                            {title}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-text-muted">
                            {record.id}
                          </div>
                        </td>

                        {/* Platform */}
                        <td className="whitespace-nowrap px-5 py-4">
                          <PlatformBadge platform={record.platform} />
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-5 py-4">
                          <PublishStatusBadge variant={variant} />
                        </td>

                        {/* Published timestamp */}
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-text-secondary">
                          {record.published_at
                            ? formatRelativeTime(record.published_at)
                            : variant === "scheduled"
                              ? "Scheduled"
                              : "—"}
                        </td>

                        {/* Cost */}
                        <td className="whitespace-nowrap px-5 py-4 text-right font-mono text-xs text-text-secondary">
                          {cost}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GenerationCard>
        )}
      </div>
    </div>
  );
}
