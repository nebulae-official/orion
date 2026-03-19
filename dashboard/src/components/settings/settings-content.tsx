"use client";

import { SettingsTabs, type SettingsTab } from "@/components/settings/settings-tabs";
import { ProviderConfig } from "@/components/provider-config";
import { ApiKeysConfig } from "@/components/settings/api-keys-config";
import { PipelineConfig } from "@/components/settings/pipeline-config";
import { SystemConfig } from "@/components/settings/system-config";

export function SettingsContent(): React.ReactElement {
  return (
    <SettingsTabs>
      {(activeTab: SettingsTab) => {
        switch (activeTab) {
          case "providers":
            return <ProviderConfig />;
          case "api-keys":
            return <ApiKeysConfig />;
          case "pipeline":
            return <PipelineConfig />;
          case "system":
            return <SystemConfig />;
        }
      }}
    </SettingsTabs>
  );
}
