import { Activity } from "lucide-react";
import { ServiceHealth, InfrastructureStatus } from "@/components/service-health";
import { GpuGauge } from "@/components/gpu-gauge";
import { SystemInfo } from "@/components/system-info";

export default function SystemPage(): React.ReactElement {
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-success" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">System Health</h1>
            <p className="mt-1 text-text-secondary">
              Monitor service status, GPU usage, and system resources.
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: System Overview + GPU Status — side by side */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SystemInfo />
        <GpuGauge />
      </div>

      {/* Section 2: Services (2/3) + Infrastructure (1/3) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ServiceHealth />
        </div>
        <div>
          <InfrastructureStatus />
        </div>
      </div>
    </div>
  );
}
