"use client";

import { useMemo, useState } from "react";

import type { ExplainedSection } from "@/lib/types";
import { previewValue } from "@/lib/utils";
import { Panel, StatusBadge } from "@/components/ui";

export function ConfigExplorer({
  sections,
  rawConfig,
  hash,
}: {
  sections: ExplainedSection[];
  rawConfig: unknown;
  hash: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return sections;
    }

    return sections.filter((section) => {
      const haystack = `${section.title} ${section.summary} ${JSON.stringify(section.data)}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, sections]);

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--brand-text-muted)]">Current config hash</p>
            <p className="mt-1 font-mono text-sm text-[var(--brand-text-primary)]">{hash}</p>
          </div>
          <label className="w-full max-w-md">
            <span className="mb-2 block text-sm font-medium text-[var(--brand-text-secondary)]">
              Search config
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-strong)] px-4 py-3 text-sm text-[var(--brand-text-primary)] outline-none ring-0 transition focus:border-[var(--brand-coral)]"
              placeholder="Search keys, values, or summaries"
            />
          </label>
        </div>
      </Panel>

      <div className="grid gap-4">
        {filtered.map((section) => (
          <Panel key={section.key}>
            <details open className="group">
              <summary className="flex cursor-pointer list-none flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">
                      {section.title}
                    </h3>
                    <StatusBadge status={section.status} />
                  </div>
                  <p className="text-sm text-[var(--brand-text-secondary)]">{section.summary}</p>
                  <p className="text-sm text-[var(--brand-text-muted)]">{section.description}</p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    navigator.clipboard.writeText(section.path).catch(() => undefined);
                  }}
                  className="rounded-lg border border-[var(--brand-border)] px-3 py-2 text-sm font-medium text-[var(--brand-text-secondary)] hover:bg-[var(--brand-surface-muted)]"
                >
                  Copy JSON path
                </button>
              </summary>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-[var(--brand-code-surface)] p-4 text-xs leading-6 text-[var(--brand-code-text)]">
                {JSON.stringify(section.data, null, 2)}
              </pre>
            </details>
          </Panel>
        ))}
      </div>

      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">
              Redacted raw config
            </h3>
            <p className="text-sm text-[var(--brand-text-secondary)]">
              Plaintext-looking values are masked before they reach the browser.
            </p>
          </div>
          <span className="rounded-full bg-[var(--brand-surface-muted)] px-3 py-1 text-xs font-semibold uppercase text-[var(--brand-text-secondary)]">
            {previewValue(hash)}
          </span>
        </div>
        <pre className="overflow-x-auto rounded-xl bg-[var(--brand-code-surface)] p-4 text-xs leading-6 text-[var(--brand-code-text)]">
          {JSON.stringify(rawConfig, null, 2)}
        </pre>
      </Panel>
    </div>
  );
}
