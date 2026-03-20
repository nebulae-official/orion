import { Sparkles } from "lucide-react";
import { GenerationTabs } from "@/components/generation-tabs";

export default function GenerationLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary-light" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">
              Generation
            </h1>
            <p className="mt-1 text-text-secondary">
              Pipeline orchestration, image generation, and video assembly.
            </p>
          </div>
        </div>
      </div>
      <GenerationTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
