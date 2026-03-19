import Link from "next/link";
import {
  Activity,
  LayoutDashboard,
  ListVideo,
  TrendingUp,
  CheckCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { DEMO_MODE } from "@/lib/config";
import { demoContent, demoTrends } from "@/lib/demo-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBgClass: string;
  titleColorClass: string;
  href: string;
  metric: number | string;
  metricLabel: string;
}

interface RecentEvent {
  id: string;
  title: string;
  meta: string;
  color: "emerald" | "violet" | "cyan" | "amber";
}

// ---------------------------------------------------------------------------
// Demo recent events
// ---------------------------------------------------------------------------

const demoRecentEvents: RecentEvent[] = [
  {
    id: "evt-1",
    title: "Publishing successful",
    meta: "2m ago \u2022 Campaign: Orion_Nexus_A",
    color: "emerald",
  },
  {
    id: "evt-2",
    title: "Generation complete",
    meta: "15m ago \u2022 Digital Twin #042",
    color: "violet",
  },
  {
    id: "evt-3",
    title: "Trend alert triggered",
    meta: "42m ago \u2022 Keyword: Spatial_UI",
    color: "cyan",
  },
  {
    id: "evt-4",
    title: "Manual review required",
    meta: "1h ago \u2022 Asset: Video_Intro_01",
    color: "amber",
  },
  {
    id: "evt-5",
    title: "Content approved",
    meta: "2h ago \u2022 Campaign: Orion_Nexus_B",
    color: "emerald",
  },
];

// ---------------------------------------------------------------------------
// Helpers — compute card metrics
// ---------------------------------------------------------------------------

function getDemoMetrics(): {
  queueCount: number;
  trendCount: number;
  approvedCount: number;
  reviewCount: number;
} {
  const queueCount = demoContent.length;
  const trendCount = demoTrends.length;
  const approvedCount = demoContent.filter(
    (c) => c.status === "approved"
  ).length;
  const reviewCount = demoContent.filter((c) => c.status === "review").length;
  return { queueCount, trendCount, approvedCount, reviewCount };
}

// ---------------------------------------------------------------------------
// Status dot color mapping
// ---------------------------------------------------------------------------

const dotStyles: Record<
  RecentEvent["color"],
  { bg: string; shadow: string }
> = {
  emerald: {
    bg: "bg-emerald-400",
    shadow: "shadow-[0_0_10px_rgba(52,211,153,0.5)]",
  },
  violet: {
    bg: "bg-violet-400",
    shadow: "shadow-[0_0_10px_rgba(167,139,250,0.5)]",
  },
  cyan: {
    bg: "bg-cyan-400",
    shadow: "shadow-[0_0_10px_rgba(34,211,238,0.5)]",
  },
  amber: {
    bg: "bg-amber-400",
    shadow: "shadow-[0_0_10px_rgba(251,191,36,0.5)]",
  },
};

// ---------------------------------------------------------------------------
// Bar chart data (static placeholder)
// ---------------------------------------------------------------------------

const barHeights = [
  { h: "h-[40%]", color: "bg-primary/20" },
  { h: "h-[60%]", color: "bg-primary/40" },
  { h: "h-[85%]", color: "bg-primary-container/60" },
  { h: "h-[50%]", color: "bg-primary/30" },
  { h: "h-[70%]", color: "bg-primary/50" },
  { h: "h-[95%]", color: "bg-primary-container" },
  { h: "h-[65%]", color: "bg-primary/40" },
  { h: "h-[45%]", color: "bg-secondary/30" },
  { h: "h-[75%]", color: "bg-secondary/50" },
  { h: "h-[90%]", color: "bg-secondary-container" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home(): React.ReactElement {
  const metrics = DEMO_MODE
    ? getDemoMetrics()
    : { queueCount: 0, trendCount: 0, approvedCount: 0, reviewCount: 0 };

  const recentEvents = DEMO_MODE ? demoRecentEvents : [];

  return (
    <div className="p-8">
      {/* ── Page Header ────────────────────────────── */}
      <header className="mb-12 flex items-start gap-4">
        <div className="p-3 bg-primary-container/20 rounded-xl border border-primary/20">
          <LayoutDashboard className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-4xl font-headline font-bold text-on-surface tracking-tight">
            Dashboard
          </h1>
          <p className="text-on-surface-variant font-body text-sm mt-1">
            Welcome to the Orion Content Agency dashboard
          </p>
        </div>
      </header>

      {/* ── Bento Grid: 4 Metric Cards ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard
          title="Content Queue"
          description="Review pending content across all connected channels."
          icon={<ListVideo className="h-6 w-6" />}
          iconBgClass="bg-violet-500/10 text-violet-300"
          titleColorClass="text-primary"
          href="/queue"
          metric={metrics.queueCount}
          metricLabel="Items Pending"
        />
        <DashboardCard
          title="Trends"
          description="View detected trends and real-time market shifts."
          icon={<TrendingUp className="h-6 w-6" />}
          iconBgClass="bg-cyan-500/10 text-cyan-300"
          titleColorClass="text-secondary"
          href="/trends"
          metric={metrics.trendCount}
          metricLabel="Active Trends"
        />
        <DashboardCard
          title="Approved"
          description="Content ready for publishing and distribution."
          icon={<CheckCircle className="h-6 w-6" />}
          iconBgClass="bg-emerald-500/10 text-emerald-300"
          titleColorClass="text-emerald-200"
          href="/queue?status=approved"
          metric={metrics.approvedCount}
          metricLabel="Ready"
        />
        <DashboardCard
          title="In Review"
          description="Content awaiting final review and feedback."
          icon={<Clock className="h-6 w-6" />}
          iconBgClass="bg-amber-500/10 text-amber-300"
          titleColorClass="text-amber-200"
          href="/queue?status=review"
          metric={metrics.reviewCount}
          metricLabel="Awaiting Review"
        />
      </div>

      {/* ── System Performance + Recent Events ─────── */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* System Performance (2/3) */}
        <div className="lg:col-span-2 glass-card rounded-xl p-8 relative overflow-hidden min-h-[400px]">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-headline text-xl font-bold tracking-tight">
              System Performance
            </h2>
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-headline tracking-widest uppercase">
              Live View
            </span>
          </div>

          {/* Bar chart placeholder */}
          <div className="w-full h-64 flex items-end gap-2 px-4">
            {barHeights.map((bar, i) => (
              <div
                key={i}
                className={`flex-1 ${bar.color} rounded-t-sm ${bar.h}`}
              />
            ))}
          </div>

          {/* Decorative watermark icon */}
          <div className="absolute bottom-0 right-0 p-8 opacity-20 pointer-events-none">
            <Sparkles className="h-24 w-24 text-primary-container" />
          </div>
        </div>

        {/* Recent Events (1/3) */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="font-headline text-xl font-bold tracking-tight mb-6">
            Recent Events
          </h2>

          {recentEvents.length > 0 ? (
            <div className="space-y-6">
              {recentEvents.map((event) => {
                const dot = dotStyles[event.color];
                return (
                  <div key={event.id} className="flex gap-4 items-start">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 ${dot.bg} ${dot.shadow}`}
                    />
                    <div>
                      <p className="text-sm font-medium text-on-surface">
                        {event.title}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {event.meta}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Activity className="h-8 w-8 text-on-surface-variant mb-3" />
              <p className="text-sm text-on-surface-variant">
                No recent events
              </p>
              <p className="text-xs text-on-surface-variant/60 mt-1">
                Events will appear as content moves through the pipeline
              </p>
            </div>
          )}

          <Link
            href="/system"
            className="block w-full mt-8 py-3 rounded-lg border border-outline-variant/30 text-[10px] font-headline tracking-widest uppercase text-center hover:bg-white/5 transition-colors"
          >
            View System Logs
          </Link>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardCard component
// ---------------------------------------------------------------------------

function DashboardCard({
  title,
  description,
  icon,
  iconBgClass,
  titleColorClass,
  href,
  metric,
  metricLabel,
}: DashboardCardProps): React.ReactElement {
  return (
    <Link
      href={href}
      className="glass-card luminous-border p-6 rounded-xl flex flex-col gap-4 group hover:scale-[1.01] transition-all duration-300"
    >
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconBgClass}`}
      >
        {icon}
      </div>
      <div>
        <h3
          className={`font-headline font-semibold text-lg tracking-tight ${titleColorClass}`}
        >
          {title}
        </h3>
        <p className="text-on-surface-variant text-sm mt-2 leading-relaxed">
          {description}
        </p>
      </div>
      <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
        <span className="font-headline text-2xl font-bold">{metric}</span>
        <span className="text-[10px] font-headline uppercase tracking-widest text-slate-500">
          {metricLabel}
        </span>
      </div>
    </Link>
  );
}
