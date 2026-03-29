"use client";

import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/ui";
import type {
  Suggestion,
  SuggestionPreview,
  SuggestionReviewMessage,
  SuggestionReviewThread,
} from "@/lib/types";

const validationStyles = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  fail: "border-rose-200 bg-rose-50 text-rose-900",
} as const;

const bubbleStyles = {
  system: "border-slate-200 bg-slate-50 text-slate-700",
  user: "border-sky-200 bg-sky-50 text-sky-950",
  assistant: "border-emerald-200 bg-emerald-50 text-emerald-950",
} as const;

function ReviewMessageCard({
  message,
  onUseProposal,
}: {
  message: SuggestionReviewMessage;
  onUseProposal: (payloadText: string) => void;
}) {
  const roleLabel =
    message.role === "assistant" ? "Assistant" : message.role === "user" ? "You" : "System";

  return (
    <div className={`rounded-2xl border p-3 text-sm ${bubbleStyles[message.role]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{roleLabel}</p>
        <div className="flex items-center gap-2 text-xs">
          {message.model ? (
            <span className="rounded-full bg-white/80 px-2 py-1 font-semibold text-slate-600">
              {message.model}
            </span>
          ) : null}
          <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap leading-6">{message.content}</p>
      {message.proposedPayloadText ? (
        <div className="mt-3 space-y-2">
          <pre className="max-h-40 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-xs leading-6 text-slate-100">
            {message.proposedPayloadText}
          </pre>
          <button
            type="button"
            onClick={() => onUseProposal(message.proposedPayloadText as string)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Use Proposed Payload
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function SuggestionReviewModal({
  suggestion,
  onClose,
  onApplied,
}: {
  suggestion: Suggestion | null;
  onClose: () => void;
  onApplied: (title: string) => void;
}) {
  const [preview, setPreview] = useState<SuggestionPreview | null>(null);
  const [thread, setThread] = useState<SuggestionReviewThread | null>(null);
  const [draftPayload, setDraftPayload] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingModel, setUpdatingModel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const suggestionId = suggestion?.id ?? null;

  useEffect(() => {
    if (!suggestionId) {
      return;
    }

    setPreview(null);
    setThread(null);
    setDraftPayload("");
    setMessage(null);
    setChatInput("");
    let cancelled = false;

    const loadPreview = async () => {
      setLoading(true);

      try {
        const response = await fetch("/api/suggestions/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: suggestionId,
          }),
        });
        const payload = (await response.json()) as SuggestionPreview & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to preview suggestion.");
        }

        if (!cancelled) {
          setPreview(payload);
          setDraftPayload(payload.exactPayload);
        }
      } catch (error) {
        if (!cancelled) {
          setPreview(null);
          setMessage(error instanceof Error ? error.message : "Unable to preview suggestion.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const loadThread = async () => {
      setThreadLoading(true);

      try {
        const response = await fetch(
          `/api/suggestions/review-thread?suggestionId=${encodeURIComponent(suggestionId)}`,
        );
        const payload = (await response.json()) as SuggestionReviewThread & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load review thread.");
        }

        if (!cancelled) {
          setThread(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load review thread.");
        }
      } finally {
        if (!cancelled) {
          setThreadLoading(false);
        }
      }
    };

    void Promise.all([loadPreview(), loadThread()]);

    return () => {
      cancelled = true;
    };
  }, [suggestionId]);

  const fetchPreview = async (payloadText?: string) => {
    if (!suggestion) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/suggestions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: suggestion.id,
          payloadText,
        }),
      });
      const payload = (await response.json()) as SuggestionPreview & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to preview suggestion.");
      }

      setPreview(payload);
      setDraftPayload(payload.exactPayload);
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "Unable to preview suggestion.");
    } finally {
      setLoading(false);
    }
  };

  const dirty = useMemo(() => {
    if (!preview) {
      return false;
    }

    return draftPayload !== preview.exactPayload;
  }, [draftPayload, preview]);

  const failedChecks = preview?.validation.filter((entry) => entry.status === "fail") ?? [];
  const applyBlocked =
    !preview || dirty || loading || applying || failedChecks.length > 0 || suggestion?.status === "requires_setup";
  const selectedModel = thread?.selectedModel ?? "";

  if (!suggestion) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Review Before Apply
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-semibold text-slate-950">{suggestion.title}</h3>
              <StatusBadge status={suggestion.status} />
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">
                {suggestion.category}
              </span>
            </div>
            <p className="max-w-3xl text-sm text-slate-600">{suggestion.why_relevant}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-6">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-semibold text-sky-900">
              The payload below is the exact content that will be applied or sent if you confirm.
            </p>
            <p className="mt-1 text-sm text-sky-800">
              You can edit it, but edited payloads must be revalidated before the final apply button
              becomes available.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Building preview...
            </div>
          ) : null}

          {message ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              {message}
            </div>
          ) : null}

          {preview ? (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Target</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{preview.target}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Summary</p>
                  <p className="mt-2 text-sm text-slate-900">{preview.summary}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Impact</p>
                  <p className="mt-2 text-sm text-slate-900">{preview.impact}</p>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="text-sm font-semibold text-slate-900">Exact payload</label>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">
                        {preview.payloadFormat}
                      </span>
                    </div>
                    <textarea
                      value={draftPayload}
                      onChange={(event) => setDraftPayload(event.target.value)}
                      className="min-h-[260px] w-full rounded-2xl border border-slate-300 bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-sky-500"
                      spellCheck={false}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={loading || applying || !dirty}
                        onClick={() => void fetchPreview(draftPayload)}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 hover:bg-slate-100"
                      >
                        Revalidate Draft
                      </button>
                      {dirty ? (
                        <p className="text-sm text-amber-700">
                          Draft changed. Revalidate to confirm the exact reviewed payload.
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Payload matches the latest validated preview.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Validation</h4>
                    <div className="mt-3 space-y-3">
                      {preview.validation.map((entry) => (
                        <div
                          key={entry.id}
                          className={`rounded-2xl border p-4 text-sm ${validationStyles[entry.status]}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold">{entry.label}</p>
                            <span className="text-xs font-semibold uppercase">{entry.status}</span>
                          </div>
                          <p className="mt-2">{entry.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {preview.diff.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Detected changes</h4>
                      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="px-4 py-3 font-medium">Path</th>
                              <th className="px-4 py-3 font-medium">Before</th>
                              <th className="px-4 py-3 font-medium">After</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.diff.map((entry) => (
                              <tr key={entry.path} className="border-t border-slate-100">
                                <td className="px-4 py-3 font-mono text-xs text-slate-900">
                                  {entry.path}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                                  {entry.before}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-900">
                                  {entry.after}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  {preview.currentConfigHash ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-500">Reviewed config hash</p>
                      <p className="mt-2 font-mono text-sm text-slate-950">
                        {preview.currentConfigHash}
                      </p>
                    </div>
                  ) : null}

                  {preview.affectedPaths.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-500">Affected paths</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {preview.affectedPaths.map((path) => (
                          <span
                            key={path}
                            className="rounded-full bg-white px-2.5 py-1 font-mono text-xs text-slate-700"
                          >
                            {path}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex min-h-[520px] flex-col rounded-2xl border border-slate-200 bg-slate-50">
                    <div className="border-b border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">Review thread</h4>
                          <p className="mt-1 text-sm text-slate-600">
                            Iterate on the suggestion here, then revalidate the payload before apply.
                          </p>
                        </div>
                        {threadLoading ? (
                          <span className="text-xs font-semibold uppercase text-slate-500">
                            Loading
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                      {thread?.messages.length ? (
                        thread.messages.map((entry) => (
                          <ReviewMessageCard
                            key={entry.id}
                            message={entry}
                            onUseProposal={(payloadText) => {
                              setDraftPayload(payloadText);
                              setMessage(
                                "Draft updated from the review thread. Revalidate it before applying.",
                              );
                            }}
                          />
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                          Start a conversation to refine this suggestion, ask what it changes, or
                          paste a candidate payload.
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-200 p-4">
                      <textarea
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        placeholder="Ask the review assistant to explain or refine this suggestion..."
                        className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-sky-500"
                      />
                      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                        <label className="flex-1">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Review model
                          </span>
                          <select
                            value={selectedModel}
                            disabled={!thread || updatingModel || sendingMessage}
                            onChange={async (event) => {
                              if (!suggestionId) {
                                return;
                              }

                              const nextModel = event.target.value;
                              setUpdatingModel(true);
                              setMessage(null);

                              try {
                                const response = await fetch("/api/suggestions/review-thread/model", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    suggestionId,
                                    selectedModel: nextModel,
                                  }),
                                });
                                const payload = (await response.json()) as SuggestionReviewThread & {
                                  error?: string;
                                };
                                if (!response.ok) {
                                  throw new Error(payload.error ?? "Unable to switch model.");
                                }

                                setThread(payload);
                              } catch (error) {
                                setMessage(
                                  error instanceof Error ? error.message : "Unable to switch model.",
                                );
                              } finally {
                                setUpdatingModel(false);
                              }
                            }}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                          >
                            {thread?.availableModels.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="md:self-end">
                          <button
                            type="button"
                            disabled={!thread || sendingMessage || !chatInput.trim()}
                            onClick={async () => {
                              if (!suggestionId || !thread || !chatInput.trim()) {
                                return;
                              }

                              setSendingMessage(true);
                              setMessage(null);

                              try {
                                const response = await fetch(
                                  "/api/suggestions/review-thread/message",
                                  {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      suggestionId,
                                      content: chatInput,
                                      draftPayload,
                                      selectedModel: thread.selectedModel,
                                    }),
                                  },
                                );
                                const payload = (await response.json()) as SuggestionReviewThread & {
                                  error?: string;
                                };
                                if (!response.ok) {
                                  throw new Error(payload.error ?? "Unable to send message.");
                                }

                                setThread(payload);
                                setChatInput("");
                              } catch (error) {
                                setMessage(
                                  error instanceof Error ? error.message : "Unable to send message.",
                                );
                              } finally {
                                setSendingMessage(false);
                              }
                            }}
                            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {sendingMessage ? "Sending..." : "Send Message"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-600">
                  {failedChecks.length > 0
                    ? "This suggestion cannot be applied until the failed checks are resolved."
                    : dirty
                      ? "Revalidate your edits before applying."
                      : "Ready to apply the reviewed payload shown above."}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={applyBlocked}
                    onClick={async () => {
                      setApplying(true);
                      setMessage(null);
                      try {
                        const response = await fetch("/api/suggestions/apply", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            id: suggestion.id,
                            confirmExecution: true,
                            payloadText: draftPayload,
                            baseHash: preview.currentConfigHash,
                          }),
                        });
                        const payload = (await response.json()) as { error?: string };
                        if (!response.ok) {
                          throw new Error(payload.error ?? "Unable to apply suggestion.");
                        }

                        onApplied(suggestion.title);
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "Unable to apply suggestion.");
                      } finally {
                        setApplying(false);
                      }
                    }}
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {applying ? "Applying..." : "Apply Reviewed Change"}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
