import { getDb } from "@/lib/db";
import type { AppSettings } from "@/lib/types";

const DEFAULT_SETTINGS: AppSettings = {
  refreshFrequency: "24h",
  notifyOnCritical: true,
  theme: "system",
  onboardingCompleted: false,
};

export const getAppSettings = (): AppSettings => {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("app_settings") as { value: string } | undefined;

  if (!row) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...(JSON.parse(row.value) as Partial<AppSettings>),
  };
};

export const updateAppSettings = (patch: Partial<AppSettings>) => {
  const next = {
    ...getAppSettings(),
    ...patch,
  };

  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run("app_settings", JSON.stringify(next));

  return next;
};
