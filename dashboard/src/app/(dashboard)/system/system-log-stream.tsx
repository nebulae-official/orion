"use client";

import { cn } from "@/lib/utils";

type LogLevel = "INFO" | "WARN" | "ERR";

interface LogEntry {
  time: string;
  level: LogLevel;
  service: string;
  message: string;
}

const DEMO_LOGS: LogEntry[] = [
  { time: "14:32:07", level: "INFO", service: "scout", message: 'trend.detected topic="#LangGraph" score=9.4' },
  { time: "14:31:52", level: "INFO", service: "director", message: "script.created job=9c1d4 scenes=4 words=320" },
  { time: "14:31:40", level: "WARN", service: "media", message: "queue.depth=23 threshold=20 backpressure=true" },
  { time: "14:30:18", level: "INFO", service: "publisher", message: "video.shipped job=7b5e1 platform=youtube" },
  { time: "14:29:55", level: "ERR", service: "media", message: "index.rebuild.failed niche=design retry=1" },
  { time: "14:28:12", level: "INFO", service: "editor", message: "tts.complete job=3f8a2 duration=12.4s" },
  { time: "14:27:01", level: "INFO", service: "gateway", message: "health.check all_services=ok" },
  { time: "14:26:44", level: "INFO", service: "scout", message: "scan.complete trends_found=101 new=14" },
  { time: "14:25:33", level: "INFO", service: "pulse", message: "metrics.flush latency_p95=38ms errors=1" },
  { time: "14:24:18", level: "WARN", service: "director", message: "llm.retry attempt=2 job=9c1d4 reason=rate_limit" },
];

const LEVEL_CLASS: Record<LogLevel, string> = {
  INFO: "text-cyan-400",
  WARN: "text-warning-light",
  ERR: "text-danger-light",
};

export function SystemLogStream(): React.ReactElement {
  return (
    <div className="glass-card luminous-border rounded-xl p-6">
      <div className="mb-3.5 flex items-center justify-between">
        <p className="font-[family-name:var(--font-display)] text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
          System Logs
        </p>
        <div className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-widest text-success">
            LIVE
          </span>
        </div>
      </div>

      <div>
        {DEMO_LOGS.map((entry, i) => (
          <div
            key={i}
            className="border-b border-border py-[5px] font-mono text-[11.5px] leading-relaxed text-text-secondary last:border-none"
          >
            <span className="mr-2.5 text-text-muted">{entry.time}</span>
            <span className={cn("font-semibold", LEVEL_CLASS[entry.level])}>
              {entry.level}
            </span>
            {"  "}
            <span className="text-text-muted">{entry.service}</span>
            {"  "}
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}
