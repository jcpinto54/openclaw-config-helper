import { ConfigExplorer } from "@/components/config-explorer";
import { PageHeader } from "@/components/ui";
import { explainConfig, getConfigHash, loadRedactedConfig } from "@/lib/openclaw";

export default async function ConfigPage() {
  const [sections, rawConfig, hash] = await Promise.all([
    explainConfig(),
    loadRedactedConfig(),
    getConfigHash(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inspector"
        title="Configuration inspector"
        description="Browse the current OpenClaw config with section-level explanations, safety cues, and redacted raw JSON."
      />
      <ConfigExplorer sections={sections} rawConfig={rawConfig} hash={hash} />
    </div>
  );
}
