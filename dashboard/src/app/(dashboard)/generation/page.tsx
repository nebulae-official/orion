import { Play } from "lucide-react";
import { GenerationProgress } from "@/components/generation-progress";

export default function GenerationPage(): React.ReactElement {
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Play className="h-8 w-8 text-gray-700" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Generation Progress
            </h1>
            <p className="mt-1 text-gray-500">
              Real-time progress tracking for content generation pipelines.
            </p>
          </div>
        </div>
      </div>
      <GenerationProgress />
    </div>
  );
}
