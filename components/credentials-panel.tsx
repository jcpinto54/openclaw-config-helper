"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Panel } from "@/components/ui";
import type { CredentialFinding, CredentialProvider } from "@/lib/types";

export function CredentialsPanel({
  plaintext,
  secured,
}: {
  plaintext: CredentialFinding[];
  secured: Array<{ keyPath: string; valuePreview: string }>;
}) {
  const router = useRouter();
  const [providers, setProviders] = useState<Record<string, CredentialProvider>>({});
  const [refIds, setRefIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return plaintext.reduce<Record<string, CredentialFinding[]>>((acc, finding) => {
      const key = finding.detectedType;
      acc[key] = [...(acc[key] ?? []), finding];
      return acc;
    }, {});
  }, [plaintext]);

  return (
    <div className="space-y-6">
      <Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-[var(--brand-coral-soft)] p-4">
            <p className="text-sm font-medium text-[var(--brand-coral-strong)]">Plaintext credentials</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--brand-text-primary)]">
              {plaintext.length}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--brand-cyan-soft)] p-4">
            <p className="text-sm font-medium text-[var(--brand-cyan-strong)]">Already secured</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--brand-text-primary)]">
              {secured.length}
            </p>
          </div>
        </div>
        {message ? <p className="mt-4 text-sm text-[var(--brand-text-secondary)]">{message}</p> : null}
      </Panel>

      {Object.entries(grouped).map(([group, items]) => (
        <Panel key={group}>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">{group}</h3>
            <p className="text-sm text-[var(--brand-text-secondary)]">
              Suggested migrations are prefilled with SecretRef environment references.
            </p>
          </div>

          <div className="grid gap-4">
            {items.map((finding) => {
              const provider = providers[finding.credentialId] ?? finding.suggestedProvider;
              const refId = refIds[finding.credentialId] ?? finding.suggestedRefId;

              return (
                <div key={finding.credentialId} className="rounded-2xl border border-[var(--brand-border)] p-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-[var(--brand-text-primary)]">
                          {finding.keyPath}
                        </h4>
                        <p className="text-sm text-[var(--brand-text-muted)]">
                          Current value: {finding.currentValuePreview}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--brand-surface-muted)] px-2.5 py-1 text-xs font-semibold uppercase text-[var(--brand-text-secondary)]">
                        {finding.currentState}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[160px,1fr,auto]">
                      <select
                        value={provider}
                        onChange={(event) =>
                          setProviders((current) => ({
                            ...current,
                            [finding.credentialId]: event.target.value as CredentialProvider,
                          }))
                        }
                        className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-strong)] px-3 py-2 text-sm text-[var(--brand-text-primary)]"
                      >
                        <option value="env">$env</option>
                        <option value="file">$file</option>
                        <option value="exec">$exec</option>
                      </select>
                      <input
                        value={refId}
                        onChange={(event) =>
                          setRefIds((current) => ({
                            ...current,
                            [finding.credentialId]: event.target.value,
                          }))
                        }
                        className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-strong)] px-3 py-2 text-sm text-[var(--brand-text-primary)]"
                      />
                      <button
                        type="button"
                        disabled={busy === finding.credentialId}
                        className="rounded-xl bg-[var(--brand-coral)] px-4 py-2 text-sm font-semibold text-white disabled:bg-[var(--brand-surface-muted)]"
                        onClick={async () => {
                          setBusy(finding.credentialId);
                          setMessage(null);
                          try {
                            const response = await fetch("/api/credentials/migrate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                keyPath: finding.keyPath,
                                provider,
                                refId,
                              }),
                            });
                            const payload = (await response.json()) as { error?: string };
                            if (!response.ok) {
                              throw new Error(payload.error ?? "Migration failed");
                            }
                            setMessage(`Migrated ${finding.keyPath} to SecretRef.`);
                            router.refresh();
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "Migration failed.");
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        {busy === finding.credentialId ? "Applying..." : "Apply"}
                      </button>
                    </div>

                    <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--brand-text-secondary)]">
                      {finding.migrationSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      ))}

      {secured.length > 0 ? (
        <Panel>
          <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">
            Already secured references
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {secured.map((entry) => (
              <div
                key={entry.keyPath}
                className="rounded-xl border border-[var(--brand-border)] p-3 text-sm"
              >
                <p className="font-medium text-[var(--brand-text-primary)]">{entry.keyPath}</p>
                <p className="mt-1 font-mono text-xs text-[var(--brand-text-muted)]">
                  {entry.valuePreview}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
