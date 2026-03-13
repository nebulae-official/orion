import { Activity } from "lucide-react";
import { ServiceHealth } from "@/components/service-health";
import { GpuGauge } from "@/components/gpu-gauge";

export default function SystemPage(): React.ReactElement {
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-success" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">System Health</h1>
            <p className="mt-1 text-text-secondary">
              Monitor service status, GPU usage, and queue sizes.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ServiceHealth />
        </div>
        <div>
          <GpuGauge />
        </div>
      </div>
    </div>
  );
}
