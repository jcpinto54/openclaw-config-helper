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
            <h3 className="text-lg font-semibold text-slate-950">Suggestions feed</h3>
            <p className="text-sm text-slate-600">
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
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {entry.label}
              </button>
            ))}
            <button
              type="button"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
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
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </Panel>

      <div className="grid gap-4">
        {visible.map((suggestion) => (
          <Panel key={suggestion.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold text-slate-950">{suggestion.title}</h3>
                  <StatusBadge status={suggestion.status} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">
                    {suggestion.category}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">
                    {suggestion.complexity}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{suggestion.why_relevant}</p>
                {suggestion.source_url ? (
                  <a
                    href={suggestion.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm font-medium text-sky-700 hover:text-sky-900"
                  >
                    Source
                  </a>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  onClick={() => {
                    setMessage(null);
                    setReviewingId(suggestion.id);
                  }}
                >
                  Review
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
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
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
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
        <h3 className="text-lg font-semibold text-slate-950">Recent history</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
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
                  <td colSpan={4} className="py-4 text-slate-500">
                    No suggestion activity yet.
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="py-3 pr-4 text-slate-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">{entry.title}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge
                        status={
                          entry.status === "pending" ? "warning" : (entry.status as SuggestionStatus)
                        }
                      />
                    </td>
                    <td className="py-3 text-slate-600">{entry.action}</td>
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
