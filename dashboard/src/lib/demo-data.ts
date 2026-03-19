/**
 * Demo fixture data for the Orion dashboard.
 *
 * When DEMO_MODE is enabled, pages use this data instead of calling the
 * Gateway API.  All types match the existing API response shapes defined
 * in @/types/api.
 */

import type {
  Content,
  ContentStatus,
  MediaAsset,
  PaginatedResponse,
  PublishRecord,
  Trend,
  User,
} from "@/types/api";

// ---------------------------------------------------------------------------
// Helpers — dates are relative to "now" so they always look fresh.
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export const demoTrends: Trend[] = [
  { id: "t-001", topic: "AI Agents Replace Junior Devs — Hype or Reality?", virality_score: 0.94, score: 0.94, source: "google_trends", keywords: ["ai", "agents", "devs", "hype"], status: "USED", detected_at: daysAgo(1), created_at: daysAgo(1) },
  { id: "t-002", topic: "Rust Adoption Surges in Enterprise Backend Systems", virality_score: 0.87, score: 0.87, source: "rss", keywords: ["rust", "enterprise", "backend"], status: "NEW", detected_at: daysAgo(2), created_at: daysAgo(2) },
  { id: "t-003", topic: "Apple Vision Pro 2 Leak Sparks AR/VR Debate", virality_score: 0.91, score: 0.91, source: "twitter", keywords: ["apple", "vision", "ar", "vr"], status: "USED", detected_at: daysAgo(0.5), created_at: daysAgo(0.5) },
  { id: "t-004", topic: "Open-Source LLMs Close the Gap on GPT-5", virality_score: 0.82, score: 0.82, source: "google_trends", keywords: ["llm", "open-source", "gpt-5"], status: "NEW", detected_at: daysAgo(3), created_at: daysAgo(3) },
  { id: "t-005", topic: "Kubernetes 1.32 Drops Docker Support Entirely", virality_score: 0.76, score: 0.76, source: "rss", keywords: ["kubernetes", "docker"], status: "DISCARDED", detected_at: daysAgo(5), created_at: daysAgo(5) },
  { id: "t-006", topic: "WebAssembly Enters the Server-Side Mainstream", virality_score: 0.73, score: 0.73, source: "twitter", keywords: ["webassembly", "wasm", "server"], status: "NEW", detected_at: daysAgo(4), created_at: daysAgo(4) },
  { id: "t-007", topic: "GTA VI Trailer Breaks YouTube Record in 4 Hours", virality_score: 0.98, score: 0.98, source: "twitter", keywords: ["gta", "vi", "youtube"], status: "USED", detected_at: daysAgo(0.2), created_at: daysAgo(0.2) },
  { id: "t-008", topic: "Nintendo Switch 2 Specs Confirmed by FCC Filing", virality_score: 0.89, score: 0.89, source: "rss", keywords: ["nintendo", "switch", "fcc"], status: "USED", detected_at: daysAgo(1.5), created_at: daysAgo(1.5) },
  { id: "t-009", topic: "Indie Roguelike Tops Steam Charts for Third Week", virality_score: 0.71, score: 0.71, source: "google_trends", keywords: ["indie", "roguelike", "steam"], status: "NEW", detected_at: daysAgo(6), created_at: daysAgo(6) },
  { id: "t-010", topic: "Cloud Gaming Latency Finally Under 20ms on 5G", virality_score: 0.67, score: 0.67, source: "twitter", keywords: ["cloud", "gaming", "latency", "5g"], status: "DISCARDED", detected_at: daysAgo(8), created_at: daysAgo(8) },
  { id: "t-011", topic: "Unreal Engine 6 Preview Stuns at GDC 2026", virality_score: 0.92, score: 0.92, source: "rss", keywords: ["unreal", "engine", "gdc"], status: "USED", detected_at: daysAgo(1), created_at: daysAgo(1) },
  { id: "t-012", topic: "Fed Signals Rate Cut — Crypto Markets Rally", virality_score: 0.85, score: 0.85, source: "google_trends", keywords: ["fed", "rate", "crypto"], status: "NEW", detected_at: daysAgo(0.3), created_at: daysAgo(0.3) },
  { id: "t-013", topic: "Stripe Launches AI-Powered Fraud Detection Suite", virality_score: 0.78, score: 0.78, source: "rss", keywords: ["stripe", "ai", "fraud"], status: "NEW", detected_at: daysAgo(2), created_at: daysAgo(2) },
  { id: "t-014", topic: "DeFi TVL Crosses $200B for First Time Since 2022", virality_score: 0.81, score: 0.81, source: "twitter", keywords: ["defi", "tvl", "200b"], status: "USED", detected_at: daysAgo(3), created_at: daysAgo(3) },
  { id: "t-015", topic: "EU Digital Euro Pilot Begins in Five Countries", virality_score: 0.69, score: 0.69, source: "google_trends", keywords: ["eu", "digital", "euro"], status: "DISCARDED", detected_at: daysAgo(7), created_at: daysAgo(7) },
  { id: "t-016", topic: "Robinhood Adds Options Trading for Commodities", virality_score: 0.64, score: 0.64, source: "rss", keywords: ["robinhood", "options", "commodities"], status: "NEW", detected_at: daysAgo(5), created_at: daysAgo(5) },
  { id: "t-017", topic: "BRICS Payment Network Gains Momentum", virality_score: 0.72, score: 0.72, source: "twitter", keywords: ["brics", "payment", "network"], status: "NEW", detected_at: daysAgo(4), created_at: daysAgo(4) },
  { id: "t-018", topic: "SEC Approves Spot Ethereum ETF Options", virality_score: 0.88, score: 0.88, source: "google_trends", keywords: ["sec", "ethereum", "etf"], status: "USED", detected_at: daysAgo(1), created_at: daysAgo(1) },
];

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const SCRIPT_A =
  "In this video, we break down the latest developments and what they mean for the industry. Let's dive in.";
const SCRIPT_B =
  "Hey everyone! Today we're covering a massive story that's been trending all week. Here's what you need to know.";
const SCRIPT_C =
  "Welcome back to the channel. This topic has been blowing up online, and for good reason. Let me explain.";

export const demoContent: Content[] = [
  // draft (2)
  { id: "c-001", title: "Why AI Agents Are Changing Software Development Forever", body: "Full article body...", status: "draft", created_at: daysAgo(1) },
  { id: "c-002", title: "Rust vs Go in 2026: Which Backend Language Wins?", body: "Full article body...", status: "draft", created_at: daysAgo(2) },
  // generating (2)
  { id: "c-003", title: "The Apple Vision Pro 2 — Everything We Know", body: "Full article body...", status: "generating", script: SCRIPT_A, confidence_score: 0.72, trend_id: "t-003", created_at: daysAgo(0.5), updated_at: hoursAgo(3) },
  { id: "c-004", title: "Open-Source LLMs Are Catching Up Fast", body: "Full article body...", status: "generating", script: SCRIPT_B, confidence_score: 0.68, trend_id: "t-004", created_at: daysAgo(1), updated_at: hoursAgo(1) },
  // review (3)
  { id: "c-005", title: "GTA VI: Why This Trailer Broke the Internet", body: "Full article body...", status: "review", script: SCRIPT_C, confidence_score: 0.91, trend_id: "t-007", created_at: daysAgo(2), updated_at: daysAgo(1) },
  { id: "c-006", title: "Nintendo Switch 2 Deep Dive: Specs, Games, Price", body: "Full article body...", status: "review", script: SCRIPT_A, confidence_score: 0.85, trend_id: "t-008", created_at: daysAgo(3), updated_at: daysAgo(1.5) },
  { id: "c-007", title: "The Fed Just Changed Everything for Crypto", body: "Full article body...", status: "review", script: SCRIPT_B, confidence_score: 0.78, trend_id: "t-012", created_at: daysAgo(1), updated_at: hoursAgo(6) },
  // approved (4)
  { id: "c-008", title: "Stripe's New AI Fraud Detection Explained", body: "Full article body...", status: "approved", script: SCRIPT_C, confidence_score: 0.88, trend_id: "t-013", created_at: daysAgo(4), updated_at: daysAgo(2) },
  { id: "c-009", title: "Cloud Gaming in 2026: Is It Finally Good?", body: "Full article body...", status: "approved", script: SCRIPT_A, confidence_score: 0.82, trend_id: "t-010", created_at: daysAgo(3), updated_at: daysAgo(1) },
  { id: "c-010", title: "DeFi's Comeback: $200 Billion and Counting", body: "Full article body...", status: "approved", script: SCRIPT_B, confidence_score: 0.9, trend_id: "t-014", created_at: daysAgo(5), updated_at: daysAgo(3) },
  { id: "c-011", title: "WebAssembly on the Server — The Future of Compute", body: "Full article body...", status: "approved", script: SCRIPT_C, confidence_score: 0.76, trend_id: "t-006", created_at: daysAgo(6), updated_at: daysAgo(4) },
  // published (2)
  { id: "c-012", title: "Indie Games Are Dominating Steam Right Now", body: "Full article body...", status: "published", script: SCRIPT_A, confidence_score: 0.93, trend_id: "t-009", created_at: daysAgo(8), updated_at: daysAgo(6), published_at: daysAgo(5) },
  { id: "c-013", title: "Kubernetes Without Docker: What You Need to Know", body: "Full article body...", status: "published", script: SCRIPT_B, confidence_score: 0.87, trend_id: "t-005", created_at: daysAgo(10), updated_at: daysAgo(7), published_at: daysAgo(6) },
  // rejected (2)
  { id: "c-014", title: "Unreal Engine 6 Preview: Next-Gen Graphics", body: "Full article body...", status: "rejected", script: SCRIPT_C, confidence_score: 0.55, trend_id: "t-011", created_at: daysAgo(4), updated_at: daysAgo(3) },
  { id: "c-015", title: "The EU Digital Euro: What It Means for You", body: "Full article body...", status: "rejected", script: SCRIPT_A, confidence_score: 0.51, trend_id: "t-015", created_at: daysAgo(7), updated_at: daysAgo(5) },
];

// ---------------------------------------------------------------------------
// Media Assets
// ---------------------------------------------------------------------------

export const demoMediaAssets: MediaAsset[] = [
  { id: "m-001", content_id: "c-005", type: "image", url: "/media/images/gta-thumb.png", width: 1920, height: 1080, file_size: 2_400_000, created_at: daysAgo(2) },
  { id: "m-002", content_id: "c-006", type: "image", url: "/media/images/switch2-thumb.png", width: 1920, height: 1080, file_size: 1_800_000, created_at: daysAgo(3) },
  { id: "m-003", content_id: "c-008", type: "image", url: "/media/images/stripe-ai.png", width: 1920, height: 1080, file_size: 950_000, created_at: daysAgo(4) },
  { id: "m-004", content_id: "c-012", type: "video", url: "/media/videos/indie-games.mp4", duration: 142, width: 1920, height: 1080, file_size: 45_000_000, created_at: daysAgo(8) },
  { id: "m-005", content_id: "c-013", type: "video", url: "/media/videos/k8s-docker.mp4", duration: 96, width: 1920, height: 1080, file_size: 32_000_000, created_at: daysAgo(10) },
  { id: "m-006", content_id: "c-007", type: "audio", url: "/media/audio/crypto-vo.mp3", duration: 65, file_size: 1_200_000, created_at: daysAgo(1) },
  { id: "m-007", content_id: "c-009", type: "image", url: "/media/images/cloud-gaming.png", width: 1920, height: 1080, file_size: 1_100_000, created_at: daysAgo(3) },
  { id: "m-008", content_id: "c-010", type: "image", url: "/media/images/defi-chart.png", width: 1920, height: 1080, file_size: 780_000, created_at: daysAgo(5) },
  { id: "m-009", content_id: "c-003", type: "image", url: "/media/images/vision-pro.png", width: 1920, height: 1080, file_size: 2_100_000, created_at: daysAgo(0.5) },
  { id: "m-010", content_id: "c-011", type: "image", url: "/media/images/wasm-server.png", width: 1920, height: 1080, file_size: 640_000, created_at: daysAgo(6) },
];

// ---------------------------------------------------------------------------
// Pipeline Runs
// ---------------------------------------------------------------------------

export interface PipelineRun {
  id: string;
  content_id: string;
  status: "completed" | "running" | "failed" | "queued";
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  stages_completed: number;
  stages_total: number;
  error: string | null;
}

export const demoPipelineRuns: PipelineRun[] = [
  { id: "pr-001", content_id: "c-012", status: "completed", started_at: hoursAgo(48), completed_at: hoursAgo(47), duration_seconds: 312, stages_completed: 6, stages_total: 6, error: null },
  { id: "pr-002", content_id: "c-013", status: "completed", started_at: hoursAgo(60), completed_at: hoursAgo(59), duration_seconds: 245, stages_completed: 6, stages_total: 6, error: null },
  { id: "pr-003", content_id: "c-005", status: "completed", started_at: hoursAgo(24), completed_at: hoursAgo(23), duration_seconds: 198, stages_completed: 6, stages_total: 6, error: null },
  { id: "pr-004", content_id: "c-003", status: "running", started_at: hoursAgo(0.5), completed_at: null, duration_seconds: null, stages_completed: 3, stages_total: 6, error: null },
  { id: "pr-005", content_id: "c-014", status: "failed", started_at: hoursAgo(36), completed_at: hoursAgo(35.5), duration_seconds: 180, stages_completed: 4, stages_total: 6, error: "Timeout waiting for image generation model" },
  { id: "pr-006", content_id: "c-004", status: "queued", started_at: hoursAgo(0.1), completed_at: null, duration_seconds: null, stages_completed: 0, stages_total: 6, error: null },
  { id: "pr-007", content_id: "c-008", status: "completed", started_at: hoursAgo(72), completed_at: hoursAgo(71), duration_seconds: 410, stages_completed: 6, stages_total: 6, error: null },
  { id: "pr-008", content_id: "c-010", status: "completed", started_at: hoursAgo(55), completed_at: hoursAgo(54), duration_seconds: 275, stages_completed: 6, stages_total: 6, error: null },
];

// ---------------------------------------------------------------------------
// Analytics — Funnel
// ---------------------------------------------------------------------------

export interface FunnelMetrics {
  generated: number;
  review: number;
  approved: number;
  published: number;
  rejected: number;
}

export const demoFunnel: FunnelMetrics = {
  generated: 77,
  review: 54,
  approved: 27,
  published: 21,
  rejected: 12,
};

// ---------------------------------------------------------------------------
// Analytics — Costs
// ---------------------------------------------------------------------------

export interface CostSummary {
  total_cost: number;
  by_category: Record<string, number>;
  record_count: number;
}

export const demoCostSummary: CostSummary = {
  total_cost: 141.47,
  by_category: {
    inference: 6.56,
    video_generation: 34.73,
    tts: 38.57,
    embedding: 40.41,
    image_generation: 21.21,
  },
  record_count: 76,
};

export interface ProviderCostSummary {
  provider: string;
  total_cost: number;
  by_category: Record<string, number>;
}

export const demoProviderCosts: ProviderCostSummary[] = [
  { provider: "ollama", total_cost: 0.49, by_category: { inference: 0.11, video_generation: 0.07, tts: 0.15, embedding: 0.12, image_generation: 0.04 } },
  { provider: "comfyui", total_cost: 56.22, by_category: { image_generation: 18.94, video_generation: 22.11, tts: 8.45, inference: 3.12, embedding: 3.6 } },
  { provider: "fal", total_cost: 62.18, by_category: { video_generation: 12.55, embedding: 28.63, tts: 14.21, image_generation: 2.23, inference: 4.56 } },
  { provider: "elevenlabs", total_cost: 22.58, by_category: { tts: 15.76, inference: 0.0, video_generation: 0.0, embedding: 6.82, image_generation: 0.0 } },
];

// ---------------------------------------------------------------------------
// Analytics — Error Trend (last 7 days, hourly)
// ---------------------------------------------------------------------------

export interface ErrorTrendData {
  timestamp: string;
  error_count: number;
  total_count: number;
  error_rate: number;
}

function generateErrorTrend(): ErrorTrendData[] {
  const data: ErrorTrendData[] = [];
  for (let h = 0; h < 168; h++) {
    const total = 10 + Math.floor(Math.random() * 20);
    const errors = Math.floor(Math.random() * Math.max(1, total * 0.12));
    data.push({
      timestamp: hoursAgo(h),
      error_count: errors,
      total_count: total,
      error_rate: total > 0 ? Math.round((errors / total) * 10000) / 10000 : 0,
    });
  }
  return data;
}

export const demoErrorTrend: ErrorTrendData[] = generateErrorTrend();

// ---------------------------------------------------------------------------
// Publishing History
// ---------------------------------------------------------------------------

export const demoPublishRecords: PublishRecord[] = [
  { id: "pub-001", content_id: "c-012", platform: "youtube", platform_post_id: "yt-abc123def", status: "published", error_message: null, published_at: daysAgo(5), created_at: daysAgo(8) },
  { id: "pub-002", content_id: "c-012", platform: "tiktok", platform_post_id: "tt-xyz789", status: "published", error_message: null, published_at: daysAgo(5), created_at: daysAgo(8) },
  { id: "pub-003", content_id: "c-013", platform: "youtube", platform_post_id: "yt-k8s456", status: "published", error_message: null, published_at: daysAgo(6), created_at: daysAgo(10) },
  { id: "pub-004", content_id: "c-013", platform: "instagram", platform_post_id: null, status: "failed", error_message: "Rate limit exceeded", published_at: null, created_at: daysAgo(10) },
  { id: "pub-005", content_id: "c-008", platform: "youtube", platform_post_id: null, status: "pending", error_message: null, published_at: null, created_at: daysAgo(4) },
  { id: "pub-006", content_id: "c-010", platform: "twitter", platform_post_id: null, status: "pending", error_message: null, published_at: null, created_at: daysAgo(5) },
  { id: "pub-007", content_id: "c-012", platform: "instagram", platform_post_id: "ig-indie42", status: "published", error_message: null, published_at: daysAgo(4.5), created_at: daysAgo(8) },
];

// ---------------------------------------------------------------------------
// System Health (demo: all services healthy)
// ---------------------------------------------------------------------------

export interface DemoDependencyChecks {
  redis: boolean;
  postgres: boolean;
}

export interface DemoServiceStatus {
  service: string;
  status: string;
  error?: string;
  uptime: string;
  queue_size: number;
  checks: DemoDependencyChecks;
}

export const demoSystemStatus: { status: string; services: DemoServiceStatus[] } = {
  status: "ok",
  services: [
    { service: "scout", status: "ok", uptime: "2h 34m", queue_size: 12, checks: { redis: true, postgres: true } },
    { service: "director", status: "ok", uptime: "2h 34m", queue_size: 3, checks: { redis: true, postgres: true } },
    { service: "media", status: "ok", uptime: "2h 30m", queue_size: 7, checks: { redis: true, postgres: true } },
    { service: "editor", status: "ok", uptime: "2h 28m", queue_size: 2, checks: { redis: true, postgres: true } },
    { service: "pulse", status: "ok", uptime: "2h 34m", queue_size: 0, checks: { redis: true, postgres: true } },
    { service: "publisher", status: "ok", uptime: "2h 32m", queue_size: 1, checks: { redis: true, postgres: true } },
  ],
};

export const demoGatewayHealth = { status: "ok" };

// ---------------------------------------------------------------------------
// System Info (demo)
// ---------------------------------------------------------------------------

export interface DemoSystemInfo {
  hostname: string;
  os: string;
  platform: string;
  architecture: string;
  num_cpu: number;
  go_version: string;
  cpu_usage: number;
  memory_total: number;
  memory_used: number;
  memory_free: number;
  memory_usage: number;
  disk_total: number;
  disk_used: number;
  disk_free: number;
  disk_usage: number;
  uptime: string;
  uptime_seconds: number;
}

export const demoSystemInfo: DemoSystemInfo = {
  hostname: "orion-prod-01",
  os: "linux",
  platform: "linux/amd64",
  architecture: "amd64",
  num_cpu: 16,
  go_version: "go1.24.1",
  cpu_usage: 23.5,
  memory_total: 68_719_476_736,
  memory_used: 34_359_738_368,
  memory_free: 34_359_738_368,
  memory_usage: 50.0,
  disk_total: 1_099_511_627_776,
  disk_used: 439_804_651_110,
  disk_free: 659_706_976_666,
  disk_usage: 40.0,
  uptime: "5d 12h 34m",
  uptime_seconds: 476_040,
};

// ---------------------------------------------------------------------------
// GPU Info (demo)
// ---------------------------------------------------------------------------

export interface DemoGpuInfo {
  name: string;
  vram_total_mb: number;
  vram_used_mb: number;
  vram_free_mb: number;
  utilization_percent: number;
  temperature_c: number | null;
  power_draw_w: number | null;
  clock_gpu_mhz: number | null;
  clock_mem_mhz: number | null;
  fan_speed_percent: number | null;
  driver_version: string;
  cuda_version: string;
}

export const demoGpuInfo: DemoGpuInfo[] = [
  {
    name: "NVIDIA RTX 4090",
    vram_total_mb: 24576,
    vram_used_mb: 8743,
    vram_free_mb: 15833,
    utilization_percent: 42,
    temperature_c: 58,
    power_draw_w: 185.5,
    clock_gpu_mhz: 2235,
    clock_mem_mhz: 10501,
    fan_speed_percent: 45,
    driver_version: "550.54.14",
    cuda_version: "12.4",
  },
];

// ---------------------------------------------------------------------------
// Analytics — Earnings
// ---------------------------------------------------------------------------

export const demoEarnings = {
  total_earnings: 4287.50,
  earnings_this_month: 1245.80,
  avg_per_post: 178.65,
  by_platform: [
    { platform: "youtube", earnings: 2150.00 },
    { platform: "tiktok", earnings: 1280.00 },
    { platform: "instagram", earnings: 580.50 },
    { platform: "twitter", earnings: 277.00 },
  ],
  trend: [
    { date: "2026-03-01", earnings: 45.20 },
    { date: "2026-03-03", earnings: 62.80 },
    { date: "2026-03-05", earnings: 38.50 },
    { date: "2026-03-07", earnings: 91.20 },
    { date: "2026-03-09", earnings: 120.40 },
    { date: "2026-03-11", earnings: 85.60 },
    { date: "2026-03-13", earnings: 156.30 },
    { date: "2026-03-15", earnings: 142.80 },
    { date: "2026-03-17", earnings: 198.50 },
    { date: "2026-03-19", earnings: 304.50 },
  ],
  top_content: [
    { content_id: "c-012", title: "Indie Games Are Dominating Steam", platform: "youtube", earnings: 450.00 },
    { content_id: "c-008", title: "Stripe's AI Fraud Detection", platform: "youtube", earnings: 380.00 },
    { content_id: "c-010", title: "DeFi's Comeback", platform: "tiktok", earnings: 320.00 },
    { content_id: "c-009", title: "Cloud Gaming in 2026", platform: "tiktok", earnings: 285.00 },
    { content_id: "c-011", title: "WebAssembly on the Server", platform: "instagram", earnings: 210.00 },
  ],
};

// ---------------------------------------------------------------------------
// Pipeline Activity (last 7 days)
// ---------------------------------------------------------------------------

export interface PipelineActivityDay {
  day: string;
  trends: number;
  generated: number;
  published: number;
}

function generatePipelineActivity(): PipelineActivityDay[] {
  const days: PipelineActivityDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const label = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    // Realistic-looking pattern: weekdays busier than weekends
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const base = isWeekend ? 3 : 7;
    const trends = base + Math.floor(Math.random() * 6);
    const generated = Math.max(1, trends - 2 - Math.floor(Math.random() * 3));
    const published = Math.max(0, generated - 1 - Math.floor(Math.random() * 3));
    days.push({ day: label, trends, generated, published });
  }
  return days;
}

export const demoPipelineActivity: PipelineActivityDay[] =
  generatePipelineActivity();

// ---------------------------------------------------------------------------
// Paginated helpers
// ---------------------------------------------------------------------------

export function getDemoContentPage(
  status?: ContentStatus,
  page = 1,
  limit = 12,
): PaginatedResponse<Content> {
  let filtered = demoContent;
  if (status) {
    filtered = filtered.filter((c) => c.status === status);
  }
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);
  return { items, page, limit, total };
}

// ---------------------------------------------------------------------------
// User / Auth (demo)
// ---------------------------------------------------------------------------

export const demoUser: User = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "admin@orion.local",
  name: "Admin",
  role: "admin",
  avatar_url: null,
  email_verified: true,
};

export interface AdminUser extends User {
  is_active: boolean;
  created_at: string;
}

export const demoAdminUsers: AdminUser[] = [
  { id: "00000000-0000-0000-0000-000000000002", email: "admin@orion.local", name: "Admin", role: "admin", avatar_url: null, email_verified: true, is_active: true, created_at: daysAgo(90) },
  { id: "00000000-0000-0000-0000-000000000003", email: "editor@orion.local", name: "Jane Editor", role: "editor", avatar_url: null, email_verified: true, is_active: true, created_at: daysAgo(60) },
  { id: "00000000-0000-0000-0000-000000000004", email: "viewer@orion.local", name: "Bob Viewer", role: "viewer", avatar_url: null, email_verified: true, is_active: true, created_at: daysAgo(30) },
  { id: "00000000-0000-0000-0000-000000000005", email: "inactive@orion.local", name: "Inactive User", role: "viewer", avatar_url: null, email_verified: false, is_active: false, created_at: daysAgo(120) },
];
