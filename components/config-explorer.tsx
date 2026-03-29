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
            <p className="text-sm font-medium text-slate-500">Current config hash</p>
            <p className="mt-1 font-mono text-sm text-slate-900">{hash}</p>
          </div>
          <label className="w-full max-w-md">
            <span className="mb-2 block text-sm font-medium text-slate-700">Search config</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-slate-500"
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
                    <h3 className="text-lg font-semibold text-slate-950">{section.title}</h3>
                    <StatusBadge status={section.status} />
                  </div>
                  <p className="text-sm text-slate-600">{section.summary}</p>
                  <p className="text-sm text-slate-500">{section.description}</p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    navigator.clipboard.writeText(section.path).catch(() => undefined);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Copy JSON path
                </button>
              </summary>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {JSON.stringify(section.data, null, 2)}
              </pre>
            </details>
          </Panel>
        ))}
      </div>

      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Redacted raw config</h3>
            <p className="text-sm text-slate-600">
              Plaintext-looking values are masked before they reach the browser.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
            {previewValue(hash)}
          </span>
        </div>
        <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
          {JSON.stringify(rawConfig, null, 2)}
        </pre>
      </Panel>
    </div>
  );
}
