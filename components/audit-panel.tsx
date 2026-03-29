"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Panel, StatusBadge } from "@/components/ui";
import type { AuditFinding } from "@/lib/types";

export function AuditPanel({
  findings,
  timestamp,
}: {
  findings: AuditFinding[];
  timestamp: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Latest audit snapshot</h3>
            <p className="text-sm text-slate-600">Updated at {new Date(timestamp).toLocaleString()}.</p>
          </div>
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            onClick={async () => {
              setBusyId("run");
              setMessage(null);
              try {
                await mutate("/api/audit/run");
                setMessage("Security audit refreshed.");
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Failed to refresh audit.");
              } finally {
                setBusyId(null);
              }
            }}
          >
            {busyId === "run" ? "Refreshing..." : "Run Audit"}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </Panel>

      <div className="grid gap-4">
        {findings.map((finding) => (
          <Panel key={finding.findingId}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold text-slate-950">{finding.title}</h3>
                  <StatusBadge status={finding.status === "pending" ? "warning" : finding.status} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">
                    {finding.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{finding.description}</p>
                <p className="text-sm text-slate-500">Current state: {finding.currentState}</p>
                {finding.fixPayload?.expectedOutcome ? (
                  <p className="text-sm text-slate-500">
                    Expected outcome: {finding.fixPayload.expectedOutcome}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === finding.findingId || finding.fixType !== "auto"}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  onClick={async () => {
                    setBusyId(finding.findingId);
                    setMessage(null);
                    try {
                      await mutate("/api/audit/apply", { findingId: finding.findingId });
                      setMessage(`Applied fix for ${finding.title}.`);
                      router.refresh();
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Failed to apply fix.");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  {busyId === finding.findingId ? "Applying..." : "Apply"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={async () => {
                    setBusyId(`dismiss-${finding.findingId}`);
                    setMessage(null);
                    try {
                      await mutate("/api/audit/dismiss", { findingId: finding.findingId });
                      setMessage(`Dismissed ${finding.title}.`);
                      router.refresh();
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Failed to dismiss finding.");
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
    </div>
  );
}
