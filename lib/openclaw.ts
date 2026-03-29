import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { readRemoteFile, writeRemoteFile } from "@/lib/runtime-store";
import type {
  ConfigRecord,
  ConfigSearchResult,
  ExplainedSection,
  GatewayStatus,
  SetupAnswers,
} from "@/lib/types";
import {
  flattenEntries,
  hashText,
  humanizeKey,
  isSecretLike,
  nowIso,
  parseConfigText,
  previewValue,
  redactSecret,
  redactSecretsDeep,
  stableStringify,
  deepMerge,
} from "@/lib/utils";

const sectionDescription: Record<string, string> = {
  gateway: "Network bind settings, gateway token posture, and heartbeat controls.",
  agents: "Active agents, workspaces, and model routing choices.",
  models: "Configured model providers, defaults, and fallback behavior.",
  channels: "Messaging surfaces that agents can reach and their policy constraints.",
  tools: "Tool categories agents may call and any scope restrictions.",
  skills: "Installed capabilities that expand what OpenClaw can do.",
  plugins: "Third-party integrations and trust posture.",
  auth: "Authentication, tokens, and external profiles.",
  credentials: "Whether secrets are inline or referenced through SecretRef providers.",
};

export const loadConfig = async () => {
  const text = await readRemoteFile("config");
  return parseConfigText(text);
};

export const loadRedactedConfig = async () => redactSecretsDeep(await loadConfig());

export const getConfigHash = async () => {
  const text = await readRemoteFile("config");
  return hashText(text);
};

const getSectionData = (config: ConfigRecord, key: string) => {
  if (key === "auth") {
    return {
      gatewayAuth: (config.gateway as Record<string, unknown> | undefined)?.auth ?? null,
      authProfiles: (config as Record<string, unknown>).authProfiles ?? null,
    };
  }

  if (key === "credentials") {
    return flattenEntries(config)
      .filter((entry) => isSecretLike(entry.path, entry.value))
      .map((entry) => ({
        path: entry.path,
        value:
          typeof entry.value === "string" ? redactSecret(entry.value) : previewValue(entry.value),
      }));
  }

  return config[key] ?? null;
};

const buildSectionSummary = (key: string, data: unknown) => {
  if (key === "gateway") {
    const gateway = (data ?? {}) as Record<string, unknown>;
    const bind = String(gateway.bind ?? "unknown");
    const port = String(gateway.port ?? "unknown");
    return `Gateway listening on ${bind}:${port}.`;
  }

  if (key === "agents") {
    const list = (((data as Record<string, unknown> | null)?.list ?? []) as unknown[]) || [];
    return `${list.length} configured agent${list.length === 1 ? "" : "s"}.`;
  }

  if (key === "models" && data && typeof data === "object") {
    return `${Object.keys(data as Record<string, unknown>).length} model provider(s) configured.`;
  }

  if (key === "channels" && data && typeof data === "object") {
    const enabled = Object.values(data as Record<string, unknown>).filter(
      (value) => typeof value === "object" && Boolean((value as Record<string, unknown>).enabled),
    );
    return `${enabled.length} channel(s) enabled.`;
  }

  if (key === "tools") {
    const enabled = (((data as Record<string, unknown> | null)?.enabled ?? []) as unknown[]) || [];
    return `${enabled.length} tool categories available to agents.`;
  }

  if (key === "skills") {
    const installed =
      (((data as Record<string, unknown> | null)?.installed ?? []) as unknown[]) || [];
    return `${installed.length} skill(s) installed.`;
  }

  if (key === "plugins") {
    const untrusted =
      (((data as Record<string, unknown> | null)?.untrusted ?? []) as unknown[]) || [];
    return untrusted.length
      ? `${untrusted.length} untrusted plugin source(s) need review.`
      : "No untrusted plugin sources detected.";
  }

  if (key === "auth") {
    return "Gateway auth and external profile references.";
  }

  if (key === "credentials") {
    const entries = Array.isArray(data) ? data.length : 0;
    return `${entries} credential-looking value(s) detected in the active config.`;
  }

  return "No summary available.";
};

const buildSectionStatus = (key: string, data: unknown) => {
  if (key === "gateway") {
    const gateway = (data ?? {}) as Record<string, unknown>;
    if (gateway.bind === "0.0.0.0") {
      return "warning";
    }
  }

  if (key === "plugins") {
    const untrusted =
      (((data as Record<string, unknown> | null)?.untrusted ?? []) as unknown[]) || [];
    if (untrusted.length) {
      return "warning";
    }
  }

  if (key === "credentials" && Array.isArray(data)) {
    const inlineCount = data.filter((entry) => {
      const value = (entry as { value?: string }).value ?? "";
      return !value.startsWith("$env:") && !value.startsWith("$file:") && !value.startsWith("$exec:");
    }).length;

    if (inlineCount > 0) {
      return "warning";
    }
  }

  return "ok";
};

export const explainConfig = async (): Promise<ExplainedSection[]> => {
  const config = await loadConfig();
  const keys = [
    "gateway",
    "agents",
    "models",
    "channels",
    "tools",
    "skills",
    "plugins",
    "auth",
    "credentials",
  ];

  return keys.map((key) => {
    const data = getSectionData(config, key);

    return {
      key,
      title: humanizeKey(key),
      path: key,
      summary: buildSectionSummary(key, data),
      description: sectionDescription[key],
      status: buildSectionStatus(key, data),
      data,
    };
  });
};

export const searchConfig = async (
  query: string,
  section?: string,
): Promise<ConfigSearchResult[]> => {
  const config = await loadConfig();
  const entries = flattenEntries(config);
  const normalizedQuery = query.trim().toLowerCase();

  return entries
    .filter((entry) => {
      if (!normalizedQuery) {
        return true;
      }

      const matchesPath = entry.path.toLowerCase().includes(normalizedQuery);
      const matchesValue = previewValue(entry.value).toLowerCase().includes(normalizedQuery);

      if (section && !entry.path.startsWith(section)) {
        return false;
      }

      return matchesPath || matchesValue;
    })
    .slice(0, 80)
    .map((entry) => ({
      path: entry.path,
      section: entry.path.split(".")[0] ?? "root",
      valuePreview:
        typeof entry.value === "string" && isSecretLike(entry.path, entry.value)
          ? redactSecret(entry.value)
          : previewValue(entry.value),
      note: isSecretLike(entry.path, entry.value)
        ? "Sensitive-looking value redacted in search results."
        : `Matches ${section ? `${section} section` : "current config"}.`,
    }));
};

export const saveConfig = async (config: ConfigRecord) => {
  const text = `${stableStringify(config)}\n`;
  await writeRemoteFile("config", text);
  getDb()
    .prepare("INSERT INTO setup_snapshots (snapshot_json) VALUES (?)")
    .run(text);
};

export const patchConfig = async (patch: Record<string, unknown>, baseHash?: string) => {
  const current = await loadConfig();
  const currentHash = await getConfigHash();

  if (baseHash && baseHash !== currentHash) {
    throw new Error("Base hash mismatch. Refresh config and try again.");
  }

  const nextConfig = deepMerge(current, patch);
  await saveConfig(nextConfig);

  return {
    success: true,
    newHash: await getConfigHash(),
    config: await loadRedactedConfig(),
  };
};

export const getInstalledSkills = async () => {
  const config = await loadConfig();
  return (((config.skills as Record<string, unknown> | undefined)?.installed ?? []) as string[]) || [];
};

export const getActiveChannels = async () => {
  const config = await loadConfig();
  const channels = (config.channels ?? {}) as Record<string, unknown>;

  return Object.entries(channels)
    .filter(
      ([, value]) => typeof value === "object" && Boolean((value as Record<string, unknown>).enabled),
    )
    .map(([key]) => key);
};

export const getGatewayStatus = async (): Promise<GatewayStatus> => {
  const config = await loadConfig();
  const gateway = (config.gateway ?? {}) as Record<string, unknown>;
  const agents =
    ((((config.agents as Record<string, unknown> | undefined)?.list ?? []) as Array<Record<string, unknown>>) ??
      []) || [];
  const model = String(
    ((agents[0] ?? {}).model as string | undefined) ??
      ((config.models as Record<string, unknown> | undefined)?.anthropic
        ? "anthropic/claude-opus-4-6"
        : "unknown"),
  );

  return {
    status: gateway.bind === "0.0.0.0" ? "degraded" : "running",
    mode: env.mockMode ? "mock" : env.gatewayToken ? "gateway" : "ssh",
    hash: await getConfigHash(),
    model,
    agents: agents.map((agent) => String(agent.id)),
    updatedAt: nowIso(),
  };
};

export const buildCurrentSetupMarkdown = async (answers?: SetupAnswers) => {
  const config = await loadConfig();
  const skills = await getInstalledSkills();
  const channels = await getActiveChannels();
  const models = Object.keys((config.models ?? {}) as Record<string, unknown>);
  const tools =
    ((((config.tools as Record<string, unknown> | undefined)?.enabled ?? []) as string[]) ?? []) || [];

  return `## Active Date
${nowIso()}

## Installed Skills
${skills.length ? skills.map((skill) => `- ${skill}`).join("\n") : "- None declared"}

## Active Channels
${channels.length ? channels.map((channel) => `- ${humanizeKey(channel)}`).join("\n") : "- None enabled"}

## Enabled Tool Categories
${tools.length ? tools.map((tool) => `- ${tool}`).join("\n") : "- None declared"}

## Models Available
${models.length ? models.map((model) => `- ${model}`).join("\n") : "- None configured"}

## Agent Capabilities Declared
- Can execute: yes
- Can modify files: yes (workspace scoped)
- Can send messages: yes

## Previously Suggested / Applied
- Maintained by the webapp activity log

## Off-Limits Domains
- ${answers?.hardLimits || "None declared"}
`;
};
