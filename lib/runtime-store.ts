import { exec as execCallback } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { accessMode, env, hasSshConfig } from "@/lib/env";
import { ensureDir } from "@/lib/server-utils";
import { getSshBridge } from "@/lib/ssh-bridge";
import { nowIso, quoteShell } from "@/lib/utils";

export type RemoteFileKind =
  | "config"
  | "suggestions"
  | "heartbeat"
  | "currentSetup"
  | "suggestionsHistory";

const DATA_DIR = path.join(process.cwd(), "data");
const MOCK_REMOTE_DIR = path.join(DATA_DIR, "mock-remote");
const execLocalShell = promisify(execCallback);

const DEFAULT_CONFIG = {
  gateway: {
    bind: "0.0.0.0",
    port: 18789,
    auth: {
      token: "gateway-token-inline-demo",
    },
    heartbeat: {
      every: "24h",
      enabled: true,
    },
  },
  agents: {
    list: [
      {
        id: "primary",
        workspace: "~/.openclaw/agents/primary",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  models: {
    anthropic: {
      model: "claude-opus-4-6",
      apiKey: "sk-ant-demo-1234567890",
      fallback: "openai/gpt-4o",
    },
    openai: {
      model: "gpt-4o",
      apiKey: "sk-openai-demo-0987654321",
    },
  },
  channels: {
    telegram: {
      enabled: true,
      botToken: "123456789:telegram-demo-token",
      allowFrom: [],
    },
    slack: {
      enabled: true,
      webhookUrl: "https://hooks.slack.com/services/T000/B000/demo-token",
    },
  },
  tools: {
    enabled: ["web_search", "file_read", "shell"],
    shell: {
      allowedPaths: ["~/workspace"],
    },
  },
  skills: {
    installed: ["github-issues", "telegram-notify", "todoist-sync"],
  },
  plugins: {
    untrusted: ["community-beta-integration"],
  },
};

const DEFAULT_SUGGESTIONS = {
  timestamp: nowIso(),
  suggestions: [
    {
      id: "github-pr-telegram-digest",
      title: "GitHub PR review digest to Telegram",
      category: "Dev",
      why_relevant:
        "You already use GitHub and Telegram, but there is no lightweight review-notification flow yet.",
      complexity: "Low",
      payload_type: "prompt",
      payload:
        "Create an OpenClaw skill that summarizes newly opened PRs and sends them to Telegram twice a day.",
      source_url: "https://openclaw.example/dev-digest",
    },
    {
      id: "secure-gateway-bind",
      title: "Lock gateway to loopback",
      category: "Automation",
      why_relevant:
        "Your current mock config exposes the gateway on 0.0.0.0. Constraining it to loopback reduces accidental exposure.",
      complexity: "Low",
      payload_type: "config.patch",
      payload: {
        gateway: {
          bind: "127.0.0.1",
        },
      },
      source_url: "https://openclaw.example/security/loopback",
    },
    {
      id: "home-assistant-climate",
      title: "Home Assistant climate coordinator",
      category: "Home",
      why_relevant:
        "This would fit the recommendation engine, but the required Home Assistant skill is not installed yet.",
      complexity: "High",
      payload_type: "prompt",
      payload:
        "Build a Home Assistant climate automation skill with quiet-hours awareness and manual override support.",
      requires: ["home-assistant"],
      source_url: "https://openclaw.example/home/climate",
    },
  ],
};

const DEFAULT_HEARTBEAT = `# Suggestions Research Heartbeat

## Your Profile
- Role: Software developer
- Devices/Services: GitHub, Telegram, Slack
- Priority: Save time
- Execution policy: Observe only
- Off-limits: Personal email

## Research Mandate
Research new OpenClaw use cases that fit this workspace.

## Deduplication & Relevance Filter
- Compare against CURRENT_SETUP.md
- Compare against SUGGESTIONS_HISTORY.md

## Output Contract
Write results to SUGGESTIONS.json.
`;

const DEFAULT_CURRENT_SETUP = `## Active Date
${nowIso()}

## Installed Skills
- github-issues
- telegram-notify
- todoist-sync

## Active Channels
- Telegram
- Slack

## Enabled Tool Categories
- web_search
- file_read
- shell

## Models Available
- anthropic/claude-opus-4-6
- openai/gpt-4o

## Agent Capabilities Declared
- Can execute: yes
- Can modify files: yes (~/workspace only)
- Can send messages: yes

## Previously Suggested / Applied
- None yet

## Off-Limits Domains
- Personal email
`;

const DEFAULT_SUGGESTIONS_HISTORY = `| Timestamp | ID | Title | Category | Status | Action |
|-----------|----|-------|----------|--------|--------|
`;

const localPaths: Record<RemoteFileKind, string> = {
  config: path.join(MOCK_REMOTE_DIR, "openclaw.json"),
  suggestions: path.join(MOCK_REMOTE_DIR, "SUGGESTIONS.json"),
  heartbeat: path.join(MOCK_REMOTE_DIR, "HEARTBEAT.md"),
  currentSetup: path.join(MOCK_REMOTE_DIR, "CURRENT_SETUP.md"),
  suggestionsHistory: path.join(MOCK_REMOTE_DIR, "SUGGESTIONS_HISTORY.md"),
};

const seedFiles = async () => {
  await ensureDir(MOCK_REMOTE_DIR);

  const seeds: Record<RemoteFileKind, string> = {
    config: `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`,
    suggestions: `${JSON.stringify(DEFAULT_SUGGESTIONS, null, 2)}\n`,
    heartbeat: DEFAULT_HEARTBEAT,
    currentSetup: DEFAULT_CURRENT_SETUP,
    suggestionsHistory: DEFAULT_SUGGESTIONS_HISTORY,
  };

  await Promise.all(
    Object.entries(localPaths).map(async ([kind, filePath]) => {
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, seeds[kind as RemoteFileKind], "utf8");
      }
    }),
  );

  await fs.chmod(localPaths.config, 0o644).catch(() => undefined);
};

export const ensureRuntimeData = async () => {
  if (accessMode === "mock") {
    await seedFiles();
  }
};

export const getResolvedPath = (kind: RemoteFileKind) => {
  if (accessMode === "mock") {
    return localPaths[kind];
  }

  switch (kind) {
    case "config":
      return env.paths.config;
    case "suggestions":
      return env.paths.suggestions;
    case "heartbeat":
      return env.paths.heartbeat;
    case "currentSetup":
      return env.paths.currentSetup;
    case "suggestionsHistory":
      return env.paths.suggestionsHistory;
  }
};

const getLocalPath = (kind: RemoteFileKind) => {
  const resolvedPath = getResolvedPath(kind);

  if (resolvedPath === "~") {
    return os.homedir();
  }

  if (resolvedPath.startsWith("~/")) {
    return path.join(os.homedir(), resolvedPath.slice(2));
  }

  return resolvedPath;
};

const ensureSshConfig = () => {
  if (accessMode === "ssh" && !hasSshConfig) {
    throw new Error("OPENCLAW_ACCESS_MODE=ssh requires SSH_HOST, SSH_USER, and SSH_KEY_PATH.");
  }
};

const execLocalCommand = async (command: string) => {
  try {
    const { stdout, stderr } = await execLocalShell(command, {
      shell: "/bin/bash",
    });
    return { stdout, stderr };
  } catch (error) {
    const execError = error as Error & {
      stdout?: string;
      stderr?: string;
    };

    return {
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? execError.message,
    };
  }
};

export const readRemoteFile = async (kind: RemoteFileKind) => {
  await ensureRuntimeData();

  if (accessMode !== "ssh") {
    return fs.readFile(getLocalPath(kind), "utf8");
  }

  ensureSshConfig();
  return getSshBridge().readFile(getResolvedPath(kind));
};

export const writeRemoteFile = async (kind: RemoteFileKind, content: string) => {
  await ensureRuntimeData();

  if (accessMode !== "ssh") {
    const localPath = getLocalPath(kind);
    await ensureDir(path.dirname(localPath));
    await fs.writeFile(localPath, content, "utf8");
    return;
  }

  ensureSshConfig();
  await getSshBridge().writeFile(getResolvedPath(kind), content);
};

export const appendRemoteFile = async (kind: RemoteFileKind, content: string) => {
  await ensureRuntimeData();

  if (accessMode !== "ssh") {
    const localPath = getLocalPath(kind);
    await ensureDir(path.dirname(localPath));
    await fs.appendFile(localPath, content, "utf8");
    return;
  }

  ensureSshConfig();
  const bridge = getSshBridge();
  const encoded = Buffer.from(content, "utf8").toString("base64");
  await bridge.execCommand(
    `python3 - <<'PY'\nfrom pathlib import Path\nimport base64\npath = Path(${quoteShell(getResolvedPath(kind))}).expanduser()\npath.parent.mkdir(parents=True, exist_ok=True)\nwith path.open('a') as handle:\n    handle.write(base64.b64decode(${quoteShell(encoded)}).decode())\nPY`,
  );
};

export const getConfigPermissions = async () => {
  await ensureRuntimeData();

  if (accessMode !== "ssh") {
    const stat = await fs.stat(getLocalPath("config"));
    return stat.mode & 0o777;
  }

  ensureSshConfig();
  const { stdout } = await getSshBridge().execCommand(
    `python3 - <<'PY'\nfrom pathlib import Path\nprint(oct(Path(${quoteShell(getResolvedPath("config"))}).expanduser().stat().st_mode & 0o777))\nPY`,
  );
  return Number.parseInt(stdout.trim(), 8);
};

export const execRemoteCommand = async (command: string) => {
  await ensureRuntimeData();

  if (accessMode === "ssh") {
    ensureSshConfig();
    return getSshBridge().execCommand(command);
  }

  if (accessMode === "local") {
    return execLocalCommand(command);
  }

  if (command.includes("chmod 600")) {
    await fs.chmod(getLocalPath("config"), 0o600);
    return { stdout: "permissions updated", stderr: "" };
  }

  if (command.includes("openclaw system event")) {
    const current = JSON.parse(await fs.readFile(getLocalPath("suggestions"), "utf8")) as {
      timestamp: string;
      suggestions: unknown[];
    };

    current.timestamp = nowIso();
    await fs.writeFile(getLocalPath("suggestions"), `${JSON.stringify(current, null, 2)}\n`, "utf8");
    return { stdout: "mock refresh triggered", stderr: "" };
  }

  return {
    stdout: `mock executed: ${command}`,
    stderr: "",
  };
};
