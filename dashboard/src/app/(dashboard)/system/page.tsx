import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_MODE } from "@/lib/config";
import { demoSystemStatus } from "@/lib/demo-data";
import { SystemServiceGrid } from "./system-service-grid";
import { SystemLogStream } from "./system-log-stream";
import { SystemInfraTable } from "./system-infra-table";

// ---------------------------------------------------------------------------
// Summary strip helpers
// ---------------------------------------------------------------------------

type PulseTone = "green" | "amber" | "red";

function PulseDot({ tone }: { tone: PulseTone }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block flex-shrink-0 rounded-full",
        tone === "green" &&
          "animate-pulse bg-success shadow-[0_0_8px] shadow-success",
        tone === "amber" &&
          "animate-pulse bg-warning shadow-[0_0_8px] shadow-warning",
        tone === "red" && "bg-danger shadow-[0_0_8px] shadow-danger",
      )}
      style={{ width: 14, height: 14 }}
    />
  );
}

function SummaryCard({
  dot,
  label,
  value,
  sub,
}: {
  dot: PulseTone;
  label: string;
  value: string;
  sub: string;
}): React.ReactElement {
  return (
    <div className="glass-card luminous-border flex items-center gap-3.5 rounded-xl p-5">
      <PulseDot tone={dot} />
      <div>
        <p className="font-[family-name:var(--font-display)] text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
          {label}
        </p>
        <p className="mt-0.5 font-[family-name:var(--font-headline)] text-2xl font-bold tabular-nums text-text">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-text-dim">{sub}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SystemPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token && !DEMO_MODE) {
    redirect("/login");
  }

  // Summary stats — computed from demo data at SSR; client components poll live.
  const services = demoSystemStatus.services;
  const healthyCount = services.filter((s) => s.status === "ok").length;
  const totalServices = services.length + 1; // +1 for gateway
  const totalQueueDepth = services.reduce((acc, s) => acc + (s.queue_size ?? 0), 0);
  const queueDot: PulseTone = totalQueueDepth > 20 ? "amber" : "green";

  return (
    <div className="p-6 sm:p-8">
      {/* Page header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-success-light/35 bg-gradient-to-br from-success/20 to-primary/20 text-success shadow-lg shadow-success/10">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.02em] text-text">
            System Health
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Service status, live log stream and infrastructure metrics.
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          dot="green"
          label="Services"
          value={`${healthyCount + 1} / ${totalServices}`}
          sub="All healthy"
        />
        <SummaryCard
          dot="green"
          label="Uptime"
          value="99.8%"
          sub="Last 30 days"
        />
        <SummaryCard
          dot={queueDot}
          label="Queue Depth"
          value={String(totalQueueDepth)}
          sub="Media backpressure"
        />
        <SummaryCard
          dot="green"
          label="Redis Pub/Sub"
          value="12"
          sub="Active channels"
        />
      </div>

      {/* Service grid + Log stream */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SystemServiceGrid />
        <SystemLogStream />
      </div>

      {/* Infrastructure table */}
      <SystemInfraTable />
    </div>
  );
}
