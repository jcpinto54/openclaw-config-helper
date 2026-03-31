"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Panel } from "@/components/ui";
import type { SetupAnswers } from "@/lib/types";

const initialState: SetupAnswers = {
  role: "Software developer",
  devicesServices: "GitHub, Telegram, Slack",
  priority: "Save time",
  executionPolicy: "Observe only",
  hardLimits: "Personal email",
};

export function SetupWizard() {
  const router = useRouter();
  const [form, setForm] = useState<SetupAnswers>(initialState);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Panel className="border-[var(--brand-border-strong)] bg-[var(--brand-coral-soft)]">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-coral-strong)]">
          First-time setup
        </p>
        <h3 className="mt-2 text-xl font-semibold text-[var(--brand-text-primary)]">
          Suggestions wizard
        </h3>
        <p className="mt-2 max-w-3xl text-sm text-[var(--brand-text-secondary)]">
          These answers become the starting heartbeat prompt for the autonomous suggestions
          agent and seed the current setup snapshot.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["role", "What's your main role?"],
          ["devicesServices", "What devices and services do you use?"],
          ["priority", "What do you want most?"],
          ["executionPolicy", "Should the agent inform or act?"],
          ["hardLimits", "Hard limits or off-limits domains"],
        ].map(([key, label]) => (
          <label key={key} className={key === "hardLimits" ? "md:col-span-2" : ""}>
            <span className="mb-2 block text-sm font-medium text-[var(--brand-text-secondary)]">
              {label}
            </span>
            <input
              value={form[key as keyof SetupAnswers]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface-strong)] px-4 py-3 text-sm text-[var(--brand-text-primary)] outline-none focus:border-[var(--brand-coral)]"
            />
          </label>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          className="rounded-xl bg-[var(--brand-coral)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-coral-strong)] disabled:bg-[var(--brand-surface-muted)]"
          onClick={async () => {
            setSaving(true);
            setMessage(null);
            try {
              const response = await fetch("/api/setup/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
              });
              const payload = (await response.json()) as { error?: string };
              if (!response.ok) {
                throw new Error(payload.error ?? "Setup failed");
              }
              setMessage("Suggestions heartbeat created and onboarding completed.");
              router.refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Setup failed.");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving..." : "Complete Setup"}
        </button>
        {message ? <p className="text-sm text-[var(--brand-text-secondary)]">{message}</p> : null}
      </div>
    </Panel>
  );
}
