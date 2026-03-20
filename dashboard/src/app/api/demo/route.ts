import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/config";
import {
  demoTrends,
  demoContent,
  demoMediaAssets,
  demoPipelineRuns,
  demoCostSummary,
  demoProviderCosts,
  demoFunnel,
  demoErrorTrend,
  demoPublishRecords,
  demoSystemStatus,
  demoGatewayHealth,
} from "@/lib/demo-data";

export async function GET(
  request: Request,
): Promise<NextResponse> {
  if (!DEMO_MODE) {
    return NextResponse.json(
      { error: "Demo mode is not enabled" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");

  const resources: Record<string, unknown> = {
    trends: { items: demoTrends, total: demoTrends.length },
    content: { items: demoContent, page: 1, limit: 20, total: demoContent.length },
    media_assets: demoMediaAssets,
    pipeline_runs: demoPipelineRuns,
    cost_summary: demoCostSummary,
    provider_costs: demoProviderCosts,
    funnel: demoFunnel,
    error_trend: demoErrorTrend,
    publishing_history: demoPublishRecords,
    system_status: demoSystemStatus,
    gateway_health: demoGatewayHealth,
  };

  if (!resource) {
    return NextResponse.json({ available: Object.keys(resources) });
  }

  const data = resources[resource];
  if (!data) {
    return NextResponse.json(
      { error: `Unknown resource: ${resource}` },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}
