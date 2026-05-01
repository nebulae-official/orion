import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { serverFetch } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";
import { demoTrends } from "@/lib/demo-data";
import { StatCard } from "@/components/charts/stat-card";
import { TrendTable } from "@/components/trend-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { Trend } from "@/types/api";

interface TrendListResponse {
  items: Trend[];
  total: number;
}

export default async function TrendsPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token && !DEMO_MODE) {
    redirect("/login");
  }

  let trends: Trend[] = [];
  let total = 0;
  let fetchError = false;

  if (DEMO_MODE) {
    trends = demoTrends;
    total = demoTrends.length;
  } else {
    try {
      const response = await serverFetch<TrendListResponse>(
        "/api/v1/scout/trends",
        {},
        token
      );
      trends = response.items;
      total = response.total;
    } catch {
      fetchError = true;
    }
  }

  const used = trends.filter((t) => t.status === "USED").length;
  const discarded = trends.filter((t) => t.status === "DISCARDED").length;
  const conversionRate =
    total > 0 ? `${((used / total) * 100).toFixed(1)}% conversion rate` : "Awaiting Scout signal";

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary-light/35 bg-gradient-to-br from-primary/30 to-cyan/25 text-primary-light shadow-lg shadow-primary/20">
          <TrendingUp className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.02em] text-text">
            Trends
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Discovered trends and their pipeline status.
          </p>
        </div>
      </div>

      {fetchError && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning-light/20 bg-warning-surface/30 p-4 text-sm text-warning-light shadow-lg shadow-black/10 backdrop-blur-xl">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <div>
            <p className="font-medium text-warning-light">Scout telemetry unavailable</p>
            <p className="mt-1 text-warning-light/80">
              Unable to load trends data. Showing cached or empty results.
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Detected" value={total.toLocaleString()} subtitle="Last 24 hours · 12 niches" />
        <StatCard title="Used for Content" value={used.toLocaleString()} subtitle={conversionRate} />
        <StatCard title="Discarded" value={discarded.toLocaleString()} subtitle="Low virality or duplicate" />
      </div>

      {trends.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-7 w-7" />}
          title="No trends detected yet"
          description="Start a trend scan to discover trending topics from social platforms and news sources."
          action={{ label: "Scan Now", href: "/generation" }}
        />
      ) : (
        <TrendTable trends={trends} />
      )}
    </div>
  );
}
