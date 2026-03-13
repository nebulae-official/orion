import { BarChart3 } from "lucide-react";
import { serverFetch } from "@/lib/api-client";
import { StatCard } from "@/components/charts/stat-card";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { CostChart } from "@/components/charts/cost-chart";
import { ProviderPie } from "@/components/charts/provider-pie";
import { ErrorTrend } from "@/components/charts/error-trend";

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

  let fetchErrors: string[] = [];

  const [funnelResult, costsResult, providerCostsResult, errorsResult] =
    await Promise.allSettled([
      serverFetch<FunnelMetrics>("/api/v1/pulse/pipeline/funnel", { revalidate: 30 }),
      serverFetch<CostSummary>("/api/v1/pulse/costs", { revalidate: 30 }),
      serverFetch<ProviderCostSummary[]>("/api/v1/pulse/costs/by-provider", { revalidate: 30 }),
      serverFetch<ErrorTrendData[]>("/api/v1/pulse/pipeline/errors?hours=168", { revalidate: 30 }),
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
    </div>
  );
}
