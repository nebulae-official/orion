import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { serverFetch } from "@/lib/api-client";
import { StatCard } from "@/components/charts/stat-card";
import { TrendTable } from "@/components/trend-table";
import type { Trend } from "@/types/api";

interface TrendListResponse {
  items: Trend[];
  total: number;
}

export default async function TrendsPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token) {
    redirect("/login");
  }

  let trends: Trend[] = [];
  let total = 0;
  let fetchError = false;

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

  const used = trends.filter((t) => t.status === "USED").length;
  const discarded = trends.filter((t) => t.status === "DISCARDED").length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-cyan" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">Trends</h1>
            <p className="mt-1 text-text-secondary">
              Discovered trends and their pipeline status.
            </p>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="mb-6 rounded-xl border border-warning-surface bg-warning-surface/30 p-4 text-sm text-warning-light">
          Unable to load trends data. Showing cached or empty results.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard title="Total Found" value={total} />
        <StatCard title="Used for Content" value={used} />
        <StatCard title="Discarded" value={discarded} />
      </div>

      <TrendTable trends={trends} />
    </div>
  );
}
