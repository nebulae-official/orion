import { Settings } from "lucide-react";
import { SettingsContent } from "@/components/settings/settings-content";

export default function SettingsPage(): React.ReactElement {
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-text-secondary" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">Settings</h1>
            <p className="mt-1 text-text-secondary">
              Configure AI providers, API keys, pipeline behavior, and system preferences.
            </p>
          </div>
        </div>
      </div>
      <SettingsContent />
    </div>
  );
}
