import Link from "next/link";
import {
  Activity,
  Bell,
  Check,
  CheckCircle,
  Clock,
  Filter,
  LayoutDashboard,
  ListVideo,
  Send,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { DEMO_MODE } from "@/lib/config";
import { demoContent, demoTrends, demoPipelineActivity } from "@/lib/demo-data";
import type { Content, ContentStatus } from "@/types/api";

interface DashboardMetric {
  label: string;
  value: string;
  suffix?: string;
  delta: string;
  deltaDirection: "up" | "down";
  description: string;
  icon: React.ReactNode;
  iconGradient: string;
}

interface PipelineStage {
  label: string;
  value: number;
  color: string;
  glow: string;
}

interface RecentEvent {
  id: string;
  title: React.ReactNode;
  meta: string;
  icon: React.ReactNode;
  tone: "emerald" | "violet" | "cyan" | "amber" | "red";
}

const pipelineStages: PipelineStage[] = [
  {
    label: "Scout",
    value: 95,
    color: "bg-success",
    glow: "shadow-[0_0_8px_rgba(16,185,129,0.4)]",
  },
  {
    label: "Director",
    value: 72,
    color: "bg-primary",
    glow: "shadow-[0_0_8px_rgba(124,58,237,0.4)]",
  },
  {
    label: "Media",
    value: 48,
    color: "bg-cyan",
    glow: "shadow-[0_0_8px_rgba(6,182,212,0.4)]",
  },
  {
    label: "Editor",
    value: 21,
    color: "bg-warning",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.4)]",
  },
  {
    label: "Publisher",
    value: 64,
    color: "bg-primary-light",
    glow: "shadow-[0_0_8px_rgba(167,139,250,0.4)]",
  },
];

const emptyPipelineStages = pipelineStages.map((stage) => ({
  ...stage,
  value: 0,
}));

const recentDemoEvents: RecentEvent[] = [
  {
    id: "evt-scout",
    title: (
      <>
        Scout detected a spike in{" "}
        <b className="font-semibold text-primary-light">#LangGraph</b>{" "}
        conversation velocity.
      </>
    ),
    meta: "2m ago - scout.trend.spike",
    icon: <Check className="h-3.5 w-3.5" />,
    tone: "emerald",
  },
  {
    id: "evt-director",
    title: (
      <>
        Director generated 4 scripts for Campaign{" "}
        <b className="font-semibold text-primary-light">Orion_Nexus_A</b>.
      </>
    ),
    meta: "5m ago - director.script.generated",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    tone: "violet",
  },
  {
    id: "evt-publisher",
    title: (
      <>
        Publisher sent{" "}
        <b className="font-semibold text-primary-light">"Quiet Genius..."</b>{" "}
        to YouTube and TikTok.
      </>
    ),
    meta: "8m ago - publisher.video.shipped",
    icon: <Send className="h-3.5 w-3.5" />,
    tone: "cyan",
  },
  {
    id: "evt-editor",
    title: (
      <>
        Approval requested from{" "}
        <b className="font-semibold text-primary-light">you</b> on "Perseid
        Swarm".
      </>
    ),
    meta: "14m ago - editor.review.requested",
    icon: <Bell className="h-3.5 w-3.5" />,
    tone: "amber",
  },
  {
    id: "evt-memory",
    title: (
      <>
        Vector index rebuild failed on niche{" "}
        <code className="rounded bg-danger/10 px-1.5 py-0.5 font-mono text-[11px] text-danger-light">
          design
        </code>{" "}
        - auto-retrying in 30s.
      </>
    ),
    meta: "22m ago - memory.index.failed",
    icon: <XCircle className="h-3.5 w-3.5" />,
    tone: "red",
  },
];

const eventToneStyles: Record<RecentEvent["tone"], string> = {
  emerald: "bg-success/15 text-success-light",
  violet: "bg-primary-surface text-primary-light",
  cyan: "bg-cyan/15 text-cyan-light",
  amber: "bg-warning/15 text-warning-light",
  red: "bg-danger/15 text-danger-light",
};

const statusStyles: Record<
  ContentStatus,
  { label: string; className: string; icon: React.ReactNode; href: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-surface-elevated text-text-secondary border border-white/10",
    icon: <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />,
    href: "/queue?status=draft",
  },
  generating: {
    label: "Rendering",
    className: "bg-info-surface text-info-light",
    icon: <Send className="h-3 w-3" />,
    href: "/queue?status=generating",
  },
  review: {
    label: "In Review",
    className: "bg-warning-surface text-warning-light",
    icon: <Clock className="h-3 w-3" />,
    href: "/queue?status=review",
  },
  approved: {
    label: "Approved",
    className: "bg-success-surface text-success-light",
    icon: <CheckCircle className="h-3 w-3" />,
    href: "/queue?status=approved",
  },
  published: {
    label: "Published",
    className: "bg-cyan-surface text-cyan-light",
    icon: <Send className="h-3 w-3" />,
    href: "/queue?status=published",
  },
  rejected: {
    label: "Rejected",
    className: "bg-danger-surface text-danger-light",
    icon: <XCircle className="h-3 w-3" />,
    href: "/queue?status=rejected",
  },
};

export default function Home(): React.ReactElement {
  const content = DEMO_MODE ? demoContent : [];
  const trends = DEMO_MODE ? demoTrends : [];
  const chartData = DEMO_MODE ? demoPipelineActivity : [];
  const metrics = getDashboardMetrics(content, trends.length);
  const queueItems = content.slice(0, 5);
  const recentEvents = DEMO_MODE ? recentDemoEvents : [];
  const stages = DEMO_MODE ? pipelineStages : emptyPipelineStages;
  const activeJobs = DEMO_MODE
    ? content.filter((item) =>
        ["draft", "generating", "review", "approved"].includes(item.status)
      ).length
    : 0;

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10 xl:px-11">
      <header className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary-light/35 bg-gradient-to-br from-primary/30 to-cyan/25 text-primary-light shadow-[0_8px_24px_-8px_rgba(124,58,237,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]">
          <LayoutDashboard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-headline text-[32px] font-bold leading-tight tracking-tight text-text">
            System Performance
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Real-time signal from the Orion content-agency swarm.{" "}
            <span className="text-text-muted">Updated 14s ago.</span>
          </p>
        </div>
      </header>

      <section
        aria-label="Dashboard metrics"
        className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="mb-7 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Panel>
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-headline text-[10px] font-medium uppercase tracking-[0.2em] text-primary-light">
                Output Velocity
              </p>
              <h2 className="mt-1 font-headline text-base font-semibold tracking-tight text-text">
                Content volume - 14 days
              </h2>
            </div>
            <div className="flex gap-1.5">
              {["14D", "30D", "Q"].map((label) => (
                <button
                  key={label}
                  type="button"
                  className={
                    label === "30D"
                      ? "rounded-lg bg-primary-surface px-2.5 py-1.5 font-body text-[11px] font-medium text-primary-light"
                      : "rounded-lg px-2.5 py-1.5 font-body text-[11px] font-medium text-text-secondary transition hover:bg-surface-hover hover:text-text"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <VolumeChart data={chartData} />
        </Panel>

        <Panel>
          <div className="mb-5">
            <p className="font-headline text-[10px] font-medium uppercase tracking-[0.2em] text-primary-light">
              Swarm
            </p>
            <h2 className="mt-1 font-headline text-base font-semibold tracking-tight text-text">
              Pipeline stages
            </h2>
          </div>

          <div>
            {stages.map((stage) => (
              <PipelineRow key={stage.label} stage={stage} />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-4">
            <div>
              <p className="font-headline text-[10px] uppercase tracking-[0.2em] text-text-muted">
                Total active jobs
              </p>
              <p className="mt-0.5 font-headline text-2xl font-bold tabular-nums text-text">
                {activeJobs}
              </p>
            </div>
            <Link
              href="/system"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary-light transition hover:bg-surface-hover hover:text-text"
            >
              View System Logs
            </Link>
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Panel>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-headline text-[10px] font-medium uppercase tracking-[0.2em] text-primary-light">
                Review
              </p>
              <h2 className="mt-1 font-headline text-base font-semibold tracking-tight text-text">
                Content Queue
              </h2>
            </div>
            <Link
              href="/queue"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-hover hover:text-text"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
            </Link>
          </div>
          <QueueSummary items={queueItems} />
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-headline text-[10px] font-medium uppercase tracking-[0.2em] text-primary-light">
                Pulse
              </p>
              <h2 className="mt-1 font-headline text-base font-semibold tracking-tight text-text">
                Recent events
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 font-headline text-[10px] uppercase tracking-[0.2em] text-success-light">
              <span className="h-1.5 w-1.5 rounded-full bg-success-light shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              Live
            </span>
          </div>
          <RecentEvents events={recentEvents} />
        </Panel>
      </section>
    </div>
  );
}

function getDashboardMetrics(
  content: Content[],
  trendCount: number
): DashboardMetric[] {
  const renderedCount = content.filter((item) =>
    ["approved", "published", "review"].includes(item.status)
  ).length;
  const publishedCount = content.filter(
    (item) => item.status === "published"
  ).length;
  const reviewCount = content.filter((item) => item.status === "review").length;

  return [
    {
      label: "Trends Detected",
      value: trendCount.toLocaleString("en-US"),
      delta: DEMO_MODE ? "+18.2%" : "0.0%",
      deltaDirection: "up",
      description: DEMO_MODE
        ? "Across 12 niches - last 24h"
        : "Waiting for scout telemetry",
      icon: <TrendingUp className="h-5 w-5" />,
      iconGradient: "from-primary to-primary-muted",
    },
    {
      label: "Videos Rendered",
      value: renderedCount.toLocaleString("en-US"),
      delta: DEMO_MODE ? "+6.4%" : "0.0%",
      deltaDirection: "up",
      description: `${reviewCount} in review - ${content.length} queue depth`,
      icon: <ListVideo className="h-5 w-5" />,
      iconGradient: "from-cyan to-cyan-muted",
    },
    {
      label: "Published Today",
      value: publishedCount.toLocaleString("en-US"),
      delta: DEMO_MODE ? "+24.1%" : "0.0%",
      deltaDirection: "up",
      description: DEMO_MODE
        ? "TikTok, YouTube, and Instagram"
        : "Publishing activity unavailable",
      icon: <Send className="h-5 w-5" />,
      iconGradient: "from-success to-emerald-600",
    },
    {
      label: "Avg Approval Time",
      value: DEMO_MODE ? "4.2" : "0",
      suffix: "m",
      delta: DEMO_MODE ? "-3.1%" : "0.0%",
      deltaDirection: "down",
      description: DEMO_MODE ? "Down from 4.4m yesterday" : "No reviews yet",
      icon: <Clock className="h-5 w-5" />,
      iconGradient: "from-warning to-amber-600",
    },
  ];
}

function MetricCard({ metric }: { metric: DashboardMetric }): React.ReactElement {
  const deltaClass =
    metric.deltaDirection === "up"
      ? "bg-success-surface text-success-light"
      : "bg-danger-surface text-danger-light";

  return (
    <article className="glass-card relative overflow-hidden rounded-xl px-5 py-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-[10px] bg-gradient-to-br ${metric.iconGradient} text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]`}
        >
          {metric.icon}
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[11.5px] font-medium tabular-nums ${deltaClass}`}
        >
          {metric.delta}
        </span>
      </div>
      <p className="font-headline text-[11px] uppercase tracking-[0.2em] text-text-muted">
        {metric.label}
      </p>
      <p className="mt-1 font-headline text-[32px] font-bold leading-none tracking-tight text-text tabular-nums">
        {metric.value}
        {metric.suffix && (
          <span className="ml-1 text-lg text-text-secondary">
            {metric.suffix}
          </span>
        )}
      </p>
      <p className="mt-2 text-[12.5px] text-text-secondary">
        {metric.description}
      </p>
    </article>
  );
}

function Panel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <section className="glass-card relative overflow-hidden rounded-xl px-5 py-5 shadow-card sm:px-6 sm:py-5">
      {children}
    </section>
  );
}

function VolumeChart({
  data,
}: {
  data: typeof demoPipelineActivity;
}): React.ReactElement {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center text-center">
        <Activity className="mb-3 h-10 w-10 text-text-muted" />
        <p className="text-sm text-text-secondary">
          Pipeline activity will appear as content is generated
        </p>
      </div>
    );
  }

  const chartData = data.slice(-14);
  const maxValue = Math.max(
    ...chartData.flatMap((point) => [point.trends, point.generated]),
    1
  );
  const trendLine = makeLinePath(chartData.map((point) => point.trends), maxValue);
  const renderLine = makeLinePath(
    chartData.map((point) => point.generated),
    maxValue
  );
  const trendArea = `${trendLine} L800,220 L0,220 Z`;
  const renderArea = `${renderLine} L800,220 L0,220 Z`;
  const peak = Math.max(...chartData.map((point) => point.trends));

  return (
    <>
      <div className="relative h-[220px]">
        <svg
          viewBox="0 0 800 220"
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label="Content volume over the last 14 days"
        >
          <defs>
            <linearGradient id="orionChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="orionChartFill2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
            {[40, 90, 140, 190].map((y) => (
              <line key={y} x1="0" y1={y} x2="800" y2={y} />
            ))}
          </g>
          <path d={trendArea} fill="url(#orionChartFill2)" />
          <path
            d={trendLine}
            fill="none"
            stroke="#22D3EE"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d={renderArea} fill="url(#orionChartFill)" />
          <path
            d={renderLine}
            fill="none"
            stroke="#A78BFA"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="800" cy={pathEndY(chartData.at(-1)?.generated ?? 0, maxValue)} r="8" fill="#A78BFA" fillOpacity="0.25" />
          <circle cx="800" cy={pathEndY(chartData.at(-1)?.generated ?? 0, maxValue)} r="4" fill="#A78BFA" />
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.04] pt-3">
        <LegendDot color="bg-primary-light shadow-[0_0_8px_#A78BFA]">
          Rendered
        </LegendDot>
        <LegendDot color="bg-cyan-light shadow-[0_0_8px_#22D3EE]">
          Trends Detected
        </LegendDot>
        <span className="ml-auto font-mono text-[11px] text-text-muted">
          peak {peak.toLocaleString("en-US")} @ day 14
        </span>
      </div>
    </>
  );
}

function makeLinePath(values: number[], maxValue: number): string {
  const width = 800;
  const height = 180;
  const top = 28;
  const denominator = Math.max(values.length - 1, 1);

  return values
    .map((value, index) => {
      const x = (index / denominator) * width;
      const y = top + height - (value / maxValue) * height;
      return `${index === 0 ? "M" : "L"}${round(x)},${round(y)}`;
    })
    .join(" ");
}

function pathEndY(value: number, maxValue: number): number {
  return round(28 + 180 - (value / maxValue) * 180);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function LegendDot({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-text-secondary">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {children}
    </span>
  );
}

function PipelineRow({ stage }: { stage: PipelineStage }): React.ReactElement {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)_44px] items-center gap-3 border-b border-white/[0.04] py-2.5 last:border-b-0">
      <span className="text-[12.5px] font-medium text-text-secondary">
        {stage.label}
      </span>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.04] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]">
        <div
          className={`h-full rounded-full ${stage.color} ${stage.glow}`}
          style={{ width: `${stage.value}%` }}
        />
      </div>
      <span className="text-right font-mono text-xs text-text tabular-nums">
        {stage.value}%
      </span>
    </div>
  );
}

function QueueSummary({ items }: { items: Content[] }): React.ReactElement {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[250px] flex-col items-center justify-center text-center">
        <ListVideo className="mb-3 h-10 w-10 text-text-muted" />
        <p className="text-sm text-text-secondary">
          Generated content awaiting review will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr>
            {["Title", "Niche", "Stage", "Status", "Ready"].map((heading) => (
              <th
                key={heading}
                className="border-b border-white/10 px-3 py-2.5 text-left font-headline text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted last:text-right first:pl-6 last:pr-6"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = statusStyles[item.status];
            return (
              <tr
                key={item.id}
                className="transition hover:bg-white/[0.04]"
              >
                <td className="border-b border-white/[0.04] px-3 py-3.5 first:pl-6">
                  <Link
                    href={`/queue/${item.id}`}
                    className="text-[13.5px] text-text transition hover:text-primary-light"
                  >
                    {item.title}
                  </Link>
                  <div className="mt-0.5 font-mono text-[11px] text-text-muted">
                    orion.trend.detected - {formatRelative(item.created_at)}
                  </div>
                </td>
                <td className="border-b border-white/[0.04] px-3 py-3.5">
                  <span className="inline-flex rounded-full bg-primary-surface px-2.5 py-1 text-[11.5px] font-medium text-primary-light">
                    {getNiche(item)}
                  </span>
                </td>
                <td className="border-b border-white/[0.04] px-3 py-3.5 text-[13.5px] text-text">
                  {getStage(item.status)}
                </td>
                <td className="border-b border-white/[0.04] px-3 py-3.5">
                  <Link
                    href={status.href}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${status.className}`}
                  >
                    {status.icon}
                    {status.label}
                  </Link>
                </td>
                <td className="border-b border-white/[0.04] px-3 py-3.5 pr-6 text-right font-mono text-[12px] text-text-secondary">
                  {item.published_at ? "Published" : item.status === "approved" ? "Ready" : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecentEvents({
  events,
}: {
  events: RecentEvent[];
}): React.ReactElement {
  if (events.length === 0) {
    return (
      <div className="flex min-h-[250px] flex-col items-center justify-center text-center">
        <Activity className="mb-3 h-10 w-10 text-text-muted" />
        <p className="text-sm text-text-secondary">
          Events will appear as content moves through the pipeline
        </p>
      </div>
    );
  }

  return (
    <div>
      {events.map((event) => (
        <div
          key={event.id}
          className="grid grid-cols-[28px_minmax(0,1fr)] gap-2.5 border-b border-white/[0.04] py-3 last:border-b-0"
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${eventToneStyles[event.tone]}`}
          >
            {event.icon}
          </div>
          <div>
            <div className="text-[13.5px] leading-normal text-text">
              {event.title}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-text-muted">
              {event.meta}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getStage(status: ContentStatus): string {
  const stageByStatus: Record<ContentStatus, string> = {
    draft: "Scout",
    generating: "Media",
    review: "Editor",
    approved: "Publisher",
    published: "Publisher",
    rejected: "Director",
  };
  return stageByStatus[status];
}

function getNiche(item: Content): string {
  if (item.title.includes("AI") || item.title.includes("LLM")) return "AI / Infra";
  if (item.title.includes("Rust") || item.title.includes("Kubernetes")) {
    return "Dev Tools";
  }
  if (item.title.includes("Vision") || item.title.includes("Cloud")) {
    return "Media Tech";
  }
  if (item.title.includes("Fed") || item.title.includes("DeFi")) return "Markets";
  if (item.title.includes("GTA") || item.title.includes("Nintendo")) {
    return "Gaming";
  }
  return "Signals";
}

function formatRelative(date: string): string {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return "recently";
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
