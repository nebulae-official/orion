import { Sparkles } from "lucide-react";
import { GenerationTabs } from "@/components/generation-tabs";

export default function GenerationLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="px-5 py-7 sm:px-8 lg:px-11 lg:py-9">
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary-light/35 bg-gradient-to-br from-primary/30 to-cyan/25 text-primary-light shadow-[0_8px_24px_-8px_rgba(124,58,237,0.45)]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">
              Generation
            </h1>
            <p className="mt-1 text-text-secondary">
              Live pipeline - agent swarm status and job tracking.
            </p>
          </div>
        </div>
      </div>
      <GenerationTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
