const boolFromEnv = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) {
    return defaultValue;
  }

  return value.toLowerCase() !== "false";
};

export type OpenClawAccessMode = "mock" | "local" | "ssh";

const parseAccessMode = (value: string | undefined): OpenClawAccessMode | null => {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "mock":
    case "local":
    case "ssh":
      return normalized;
    default:
      return null;
  }
};

export const env = {
  mockMode: boolFromEnv(process.env.MOCK_MODE, true),
  configuredAccessMode: parseAccessMode(process.env.OPENCLAW_ACCESS_MODE),
  sshHost: process.env.SSH_HOST ?? "",
  sshUser: process.env.SSH_USER ?? "",
  sshKeyPath: process.env.SSH_KEY_PATH ?? "",
  gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN ?? "",
  webappPort: Number(process.env.WEBAPP_PORT ?? "3000"),
  webappSecret: process.env.WEBAPP_SECRET ?? "change-me",
  paths: {
    config: process.env.OPENCLAW_CONFIG_PATH ?? "~/.openclaw/openclaw.json",
    suggestions:
      process.env.OPENCLAW_SUGGESTIONS_PATH ??
      "~/.openclaw/agents/suggestions/SUGGESTIONS.json",
    heartbeat:
      process.env.OPENCLAW_HEARTBEAT_PATH ??
      "~/.openclaw/agents/suggestions/HEARTBEAT.md",
    currentSetup:
      process.env.OPENCLAW_CURRENT_SETUP_PATH ??
      "~/.openclaw/agents/suggestions/CURRENT_SETUP.md",
    suggestionsHistory:
      process.env.OPENCLAW_SUGGESTIONS_HISTORY_PATH ??
      "~/.openclaw/agents/suggestions/SUGGESTIONS_HISTORY.md",
  },
};

export const hasSshConfig =
  Boolean(env.sshHost) && Boolean(env.sshUser) && Boolean(env.sshKeyPath);

export const accessMode: OpenClawAccessMode =
  env.configuredAccessMode ?? (env.mockMode ? "mock" : hasSshConfig ? "ssh" : "mock");
