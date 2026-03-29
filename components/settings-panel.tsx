"use client";

import { useState } from "react";

import { Panel } from "@/components/ui";
import type { AppSettings } from "@/lib/types";

export function SettingsPanel({
  settings,
  connection,
}: {
  settings: AppSettings;
  connection: {
    mode: string;
    sshHost: string | null;
    sshUser: string | null;
    hasGatewayToken: boolean;
  };
}) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Panel>
        <h3 className="text-lg font-semibold text-slate-950">Runtime connection</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-slate-100 p-4 text-sm">
            <p className="text-slate-500">Mode</p>
            <p className="mt-1 font-semibold text-slate-950">{connection.mode}</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-4 text-sm">
            <p className="text-slate-500">SSH host</p>
            <p className="mt-1 font-semibold text-slate-950">{connection.sshHost ?? "Not set"}</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-4 text-sm">
            <p className="text-slate-500">Gateway token</p>
            <p className="mt-1 font-semibold text-slate-950">
              {connection.hasGatewayToken ? "Present" : "Not set"}
            </p>
          </div>
        </div>
      </Panel>

      <Panel>
        <h3 className="text-lg font-semibold text-slate-950">App preferences</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">Refresh frequency</span>
            <select
              value={form.refreshFrequency}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  refreshFrequency: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="24h">Every 24 hours</option>
              <option value="12h">Every 12 hours</option>
              <option value="daily-09:00">Every morning at 09:00</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">Theme</span>
            <select
              value={form.theme}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  theme: event.target.value as AppSettings["theme"],
                }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="flex items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              checked={form.notifyOnCritical}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notifyOnCritical: event.target.checked,
                }))
              }
              type="checkbox"
              className="size-4"
            />
            <span className="text-sm font-medium text-slate-700">Notify on critical findings</span>
          </label>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
            onClick={async () => {
              setSaving(true);
              setMessage(null);
              try {
                const response = await fetch("/api/settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(form),
                });
                const payload = (await response.json()) as { error?: string };
                if (!response.ok) {
                  throw new Error(payload.error ?? "Settings update failed");
                }
                setMessage("Settings saved.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Settings update failed.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      </Panel>
    </div>
  );
}
