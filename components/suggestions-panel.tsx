"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SuggestionReviewModal } from "@/components/suggestion-review-modal";
import { Panel, StatusBadge } from "@/components/ui";
import type { Suggestion, SuggestionHistoryEntry, SuggestionStatus } from "@/lib/types";

const FILTERS: Array<{ label: string; value: "all" | SuggestionStatus }> = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Saved", value: "saved" },
  { label: "Applied", value: "applied" },
  { label: "Needs Setup", value: "requires_setup" },
];

export function SuggestionsPanel({
  suggestions,
  history,
  timestamp,
}: {
  suggestions: Suggestion[];
  history: SuggestionHistoryEntry[];
  timestamp: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | SuggestionStatus>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (filter === "all") {
      return suggestions;
    }

    return suggestions.filter((item) => item.status === filter);
  }, [filter, suggestions]);

  const reviewingSuggestion =
    suggestions.find((item) => item.id === reviewingId) ?? null;

  const mutate = async (url: string, body?: Record<string, unknown>) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json()) as { error?: string; result?: string; status?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed");
    }
    return payload;
  };

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">Suggestions feed</h3>
            <p className="text-sm text-[var(--brand-text-secondary)]">
              Last refreshed at {new Date(timestamp).toLocaleString()}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setFilter(entry.value)}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${
                  filter === entry.value
                    ? "bg-[var(--brand-coral)] text-white"
                    : "bg-[var(--brand-surface-muted)] text-[var(--brand-text-secondary)] hover:bg-[var(--brand-cyan-soft)]"
                }`}
              >
                {entry.label}
              </button>
            ))}
            <button
              type="button"
              className="rounded-xl bg-[var(--brand-coral)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-coral-strong)]"
              onClick={async () => {
                setBusyId("refresh");
                setMessage(null);
                try {
                  await mutate("/api/suggestions/refresh");
                  setMessage("Triggered a manual refresh.");
                  router.refresh();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Refresh failed.");
                } finally {
                  setBusyId(null);
                }
              }}
            >
              {busyId === "refresh" ? "Refreshing..." : "Refresh Now"}
            </button>
          </div>
        </div>
        {message ? <p className="mt-3 text-sm text-[var(--brand-text-secondary)]">{message}</p> : null}
      </Panel>

      <div className="grid gap-4">
        {visible.map((suggestion) => (
          <Panel key={suggestion.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">
                    {suggestion.title}
                  </h3>
                  <StatusBadge status={suggestion.status} />
                  <span className="rounded-full bg-[var(--brand-surface-muted)] px-2.5 py-1 text-xs font-semibold uppercase text-[var(--brand-text-secondary)]">
                    {suggestion.category}
                  </span>
                  <span className="rounded-full bg-[var(--brand-surface-muted)] px-2.5 py-1 text-xs font-semibold uppercase text-[var(--brand-text-secondary)]">
                    {suggestion.complexity}
                  </span>
                </div>
                <p className="text-sm text-[var(--brand-text-secondary)]">{suggestion.why_relevant}</p>
                {suggestion.source_url ? (
                  <a
                    href={suggestion.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm font-medium text-[var(--brand-coral)] hover:text-[var(--brand-cyan)]"
                  >
                    Source
                  </a>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[var(--brand-cyan)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-cyan-strong)]"
                  onClick={() => {
                    setMessage(null);
                    setReviewingId(suggestion.id);
                  }}
                >
                  Review
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--brand-border)] px-3 py-2 text-sm font-semibold text-[var(--brand-text-secondary)] hover:bg-[var(--brand-surface-muted)]"
                  onClick={async () => {
                    setBusyId(`save-${suggestion.id}`);
                    setMessage(null);
                    try {
                      await mutate("/api/suggestions/save", { id: suggestion.id });
                      setMessage(`Saved ${suggestion.title}.`);
                      router.refresh();
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Save failed.");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--brand-border)] px-3 py-2 text-sm font-semibold text-[var(--brand-text-secondary)] hover:bg-[var(--brand-surface-muted)]"
                  onClick={async () => {
                    setBusyId(`dismiss-${suggestion.id}`);
                    setMessage(null);
                    try {
                      await mutate("/api/suggestions/dismiss", { id: suggestion.id });
                      setMessage(`Dismissed ${suggestion.title}.`);
                      router.refresh();
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Dismiss failed.");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <Panel>
        <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">Recent history</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--brand-text-muted)]">
              <tr>
                <th className="pb-2 pr-4 font-medium">When</th>
                <th className="pb-2 pr-4 font-medium">Suggestion</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-[var(--brand-text-muted)]">
                    No suggestion activity yet.
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry.id} className="border-t border-[var(--brand-border)]">
                    <td className="py-3 pr-4 text-[var(--brand-text-muted)]">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 font-medium text-[var(--brand-text-primary)]">
                      {entry.title}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge
                        status={
                          entry.status === "pending" ? "warning" : (entry.status as SuggestionStatus)
                        }
                      />
                    </td>
                    <td className="py-3 text-[var(--brand-text-secondary)]">{entry.action}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <SuggestionReviewModal
        suggestion={reviewingSuggestion}
        onClose={() => setReviewingId(null)}
        onApplied={(title) => {
          setReviewingId(null);
          setMessage(`Applied ${title}.`);
          router.refresh();
        }}
      />
    </div>
  );
}
