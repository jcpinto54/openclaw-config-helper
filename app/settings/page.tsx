import { PageHeader } from "@/components/ui";
import { SettingsPanel } from "@/components/settings-panel";
import { accessMode, env } from "@/lib/env";
import { getAppSettings } from "@/lib/settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Settings"
        description="Tune refresh behavior and see whether the app is running in mock mode or against a live local or SSH-backed OpenClaw deployment."
      />
      <SettingsPanel
        settings={getAppSettings()}
        connection={{
          accessMode,
          sshHost: env.sshHost || null,
          sshUser: env.sshUser || null,
          hasGatewayToken: Boolean(env.gatewayToken),
        }}
      />
    </div>
  );
}
