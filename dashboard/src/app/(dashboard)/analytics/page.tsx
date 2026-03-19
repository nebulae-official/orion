import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BarChart3, DollarSign, TrendingUp } from "lucide-react";
import { serverFetch } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";
import {
  demoFunnel,
  demoCostSummary,
  demoProviderCosts,
  demoErrorTrend,
  demoEarnings,
} from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/charts/stat-card";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { CostChart } from "@/components/charts/cost-chart";
import { ProviderPie } from "@/components/charts/provider-pie";
import { ErrorTrend } from "@/components/charts/error-trend";
import { EarningsChart } from "@/components/charts/earnings-chart";
import { EarningsTrend } from "@/components/charts/earnings-trend";

interface FunnelMetrics {
  generated: number;
  review: number;
  approved: number;
  published: number;
  rejected: number;
}

interface CostSummary {
  total_cost: number;
  by_category: Record<string, number>;
  record_count: number;
}

interface ProviderCostSummary {
  provider: string;
  total_cost: number;
  by_category: Record<string, number>;
}

interface ErrorTrendData {
  timestamp: string;
  error_count: number;
  total_count: number;
  error_rate: number;
}

export default async function AnalyticsPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token && !DEMO_MODE) {
    redirect("/login");
  }

  let funnel: FunnelMetrics = {
    generated: 0,
    review: 0,
    approved: 0,
    published: 0,
    rejected: 0,
  };
  let costs: CostSummary = { total_cost: 0, by_category: {}, record_count: 0 };
  let providerCosts: ProviderCostSummary[] = [];
  let errors: ErrorTrendData[] = [];

  const fetchErrors: string[] = [];

  if (DEMO_MODE) {
    funnel = demoFunnel;
    costs = demoCostSummary;
    providerCosts = demoProviderCosts;
    errors = demoErrorTrend;
  } else {
    const [funnelResult, costsResult, providerCostsResult, errorsResult] =
      await Promise.allSettled([
        serverFetch<FunnelMetrics>("/api/v1/pulse/pipeline/funnel", {}, token),
        serverFetch<CostSummary>("/api/v1/pulse/costs", {}, token),
        serverFetch<ProviderCostSummary[]>("/api/v1/pulse/costs/by-provider", {}, token),
        serverFetch<ErrorTrendData[]>("/api/v1/pulse/pipeline/errors?hours=168", {}, token),
      ]);

    if (funnelResult.status === "fulfilled") {
      funnel = funnelResult.value;
    } else {
      fetchErrors.push("pipeline funnel");
    }

    if (costsResult.status === "fulfilled") {
      costs = costsResult.value;
    } else {
      fetchErrors.push("cost summary");
    }

    if (providerCostsResult.status === "fulfilled") {
      providerCosts = providerCostsResult.value;
    } else {
      fetchErrors.push("provider costs");
    }

    if (errorsResult.status === "fulfilled") {
      errors = errorsResult.value;
    } else {
      fetchErrors.push("error trends");
    }
  }

  const approvalRate =
    funnel.generated > 0
      ? ((funnel.approved / funnel.generated) * 100).toFixed(1)
      : "0";

  const funnelData = [
    { stage: "Generated", count: funnel.generated, color: "var(--color-primary-light)" },
    { stage: "In Review", count: funnel.review, color: "var(--color-gold)" },
    { stage: "Approved", count: funnel.approved, color: "var(--color-success)" },
    { stage: "Published", count: funnel.published, color: "var(--color-cyan)" },
    { stage: "Rejected", count: funnel.rejected, color: "var(--color-danger)" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary-light" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">Analytics</h1>
            <p className="mt-1 text-text-secondary">
              Pipeline performance, costs, and provider usage.
            </p>
          </div>
        </div>
      </div>

      {fetchErrors.length > 0 && (
        <div className="mb-6 rounded-xl border border-warning-surface bg-warning-surface/30 p-4 text-sm text-warning-light">
          Unable to load some analytics data ({fetchErrors.join(", ")}). Partial results shown.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard title="Total Generated" value={funnel.generated} />
        <StatCard title="Approval Rate" value={`${approvalRate}%`} />
        <StatCard
          title="Total Cost"
          value={`$${costs.total_cost.toFixed(2)}`}
          subtitle="Last 30 days"
        />
      </div>

      <div className="mb-6">
        <FunnelChart data={funnelData} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CostChart data={providerCosts} />
        <ProviderPie data={providerCosts} />
      </div>

      <div className="mt-6">
        <ErrorTrend data={errors} />
      </div>

      {/* Earnings Section */}
      <div className="mt-10">
        <div className="mb-6 flex items-center gap-3">
          <DollarSign className="h-7 w-7 text-emerald-400" />
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-text">
            Earnings
          </h2>
        </div>

        {DEMO_MODE ? (
          <>
            <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  <p className="text-sm font-medium text-text-muted">Total Earnings</p>
                </div>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-emerald-400">
                  ${demoEarnings.total_earnings.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <p className="text-sm font-medium text-text-muted">Earnings This Month</p>
                </div>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-emerald-400">
                  ${demoEarnings.earnings_this_month.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-400" />
                  <p className="text-sm font-medium text-text-muted">Avg Per Post</p>
                </div>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-emerald-400">
                  ${demoEarnings.avg_per_post.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <EarningsChart data={demoEarnings.by_platform} />
              <EarningsTrend data={demoEarnings.trend} />
            </div>

            <div className="rounded-xl border border-border bg-surface p-6">
              <h3 className="mb-4 text-lg font-semibold text-text">Top Earning Content</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-muted">
                      <th className="pb-3 pr-4 font-medium">Rank</th>
                      <th className="pb-3 pr-4 font-medium">Title</th>
                      <th className="pb-3 pr-4 font-medium">Platform</th>
                      <th className="pb-3 text-right font-medium">Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoEarnings.top_content.map((item, index) => (
                      <tr key={item.content_id} className="border-b border-border/50 last:border-0">
                        <td className="py-3 pr-4 text-text-muted">#{index + 1}</td>
                        <td className="py-3 pr-4 text-text">{item.title}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={cn(
                              "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                              item.platform === "youtube" && "bg-red-500/15 text-red-400",
                              item.platform === "tiktok" && "bg-cyan-500/15 text-cyan-400",
                              item.platform === "instagram" && "bg-pink-500/15 text-pink-400",
                              item.platform === "twitter" && "bg-blue-500/15 text-blue-400",
                            )}
                          >
                            {item.platform === "youtube" && "YouTube"}
                            {item.platform === "tiktok" && "TikTok"}
                            {item.platform === "instagram" && "Instagram"}
                            {item.platform === "twitter" && "Twitter"}
                          </span>
                        </td>
                        <td className="py-3 text-right font-medium text-emerald-400">
                          ${item.earnings.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-12 text-center">
            <DollarSign className="mx-auto mb-3 h-10 w-10 text-text-dim" />
            <p className="text-text-muted">
              Earnings data will appear once platform integrations are connected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
