const boolFromEnv = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) {
    return defaultValue;
  }

  return value.toLowerCase() !== "false";
};

export const env = {
  mockMode: boolFromEnv(process.env.MOCK_MODE, true),
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
