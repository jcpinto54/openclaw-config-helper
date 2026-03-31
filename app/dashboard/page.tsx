import Link from "next/link";

import { SetupWizard } from "@/components/setup-wizard";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/ui";
import { getLatestFindings } from "@/lib/audit";
import { scanCredentials } from "@/lib/credentials";
import { explainConfig, getGatewayStatus } from "@/lib/openclaw";
import { getAppSettings } from "@/lib/settings";
import { listSuggestions } from "@/lib/suggestions";

export default async function DashboardPage() {
  const [gateway, sections, audit, credentials, suggestions] = await Promise.all([
    getGatewayStatus(),
    explainConfig(),
    getLatestFindings(),
    scanCredentials(),
    listSuggestions(),
  ]);
  const settings = getAppSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Deployment dashboard"
        description="A high-level snapshot of gateway health, security posture, secret hygiene, and recommendation activity."
      />

      {!settings.onboardingCompleted ? <SetupWizard /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Gateway status"
          value={gateway.status}
          tone={gateway.status === "degraded" ? "warning" : "success"}
          hint={`File access: ${gateway.accessMode} | Gateway: ${gateway.gatewayConnected ? "connected" : "disconnected"}, hash ${gateway.hash}`}
        />
        <StatCard
          label="Security findings"
          value={String(audit.findings.length)}
          tone={audit.findings.some((finding) => finding.severity === "critical") ? "danger" : "default"}
          hint="Critical and high issues are surfaced first."
        />
        <StatCard
          label="Plaintext credentials"
          value={String(credentials.plaintext.length)}
          tone={credentials.plaintext.length > 0 ? "danger" : "success"}
          hint="Values are detected heuristically from the active config."
        />
        <StatCard
          label="Suggestions in feed"
          value={String(suggestions.suggestions.length)}
          tone="default"
          hint={`Last refreshed ${new Date(suggestions.timestamp).toLocaleTimeString()}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">Config sections</h3>
              <p className="text-sm text-[var(--brand-text-secondary)]">
                Plain-English summaries of the live OpenClaw config.
              </p>
            </div>
            <Link
              href="/config"
              className="text-sm font-semibold text-[var(--brand-coral)] hover:text-[var(--brand-cyan)]"
            >
              Open config
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {sections.map((section) => (
              <div key={section.key} className="rounded-xl border border-[var(--brand-border)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="font-semibold text-[var(--brand-text-primary)]">{section.title}</h4>
                  <StatusBadge status={section.status} />
                </div>
                <p className="text-sm text-[var(--brand-text-secondary)]">{section.summary}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-6">
          <Panel>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">Top findings</h3>
                <p className="text-sm text-[var(--brand-text-secondary)]">Latest security audit output.</p>
              </div>
              <Link
                href="/audit"
                className="text-sm font-semibold text-[var(--brand-coral)] hover:text-[var(--brand-cyan)]"
              >
                Review findings
              </Link>
            </div>
            <div className="space-y-3">
              {audit.findings.slice(0, 3).map((finding) => (
                <div key={finding.findingId} className="rounded-xl border border-[var(--brand-border)] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="font-semibold text-[var(--brand-text-primary)]">{finding.title}</h4>
                    <span className="rounded-full bg-[var(--brand-surface-muted)] px-2.5 py-1 text-xs font-semibold uppercase text-[var(--brand-text-secondary)]">
                      {finding.severity}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--brand-text-secondary)]">{finding.currentState}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">
                  Latest suggestions
                </h3>
                <p className="text-sm text-[var(--brand-text-secondary)]">
                  Recommendation cards tailored to the current setup.
                </p>
              </div>
              <Link
                href="/suggestions"
                className="text-sm font-semibold text-[var(--brand-coral)] hover:text-[var(--brand-cyan)]"
              >
                Open feed
              </Link>
            </div>
            <div className="space-y-3">
              {suggestions.suggestions.slice(0, 3).map((suggestion) => (
                <div key={suggestion.id} className="rounded-xl border border-[var(--brand-border)] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="font-semibold text-[var(--brand-text-primary)]">{suggestion.title}</h4>
                    <StatusBadge status={suggestion.status} />
                  </div>
                  <p className="text-sm text-[var(--brand-text-secondary)]">{suggestion.why_relevant}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
