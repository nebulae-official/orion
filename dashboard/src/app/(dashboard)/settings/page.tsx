import { Settings } from "lucide-react";
import { ProviderConfig } from "@/components/provider-config";

export default function SettingsPage(): React.ReactElement {
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-gray-700" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="mt-1 text-gray-500">
              Configure AI providers and model selections for each service.
            </p>
          </div>
        </div>
      </div>
      <ProviderConfig />
    </div>
  );
}
