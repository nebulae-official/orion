import { Play } from "lucide-react";
import { GenerationProgress } from "@/components/generation-progress";

export default function GenerationPage(): React.ReactElement {
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Play className="h-8 w-8 text-primary-light" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">
              Generation Progress
            </h1>
            <p className="mt-1 text-text-secondary">
              Real-time progress tracking for content generation pipelines.
            </p>
          </div>
        </div>
      </div>
      <GenerationProgress />
    </div>
  );
}
