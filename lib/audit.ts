import fs from "node:fs/promises";
import path from "node:path";

import { getDb } from "@/lib/db";
import { getResolvedPath, getConfigPermissions, execRemoteCommand } from "@/lib/runtime-store";
import { writeJson } from "@/lib/server-utils";
import type { AuditFinding } from "@/lib/types";
import { nowIso, previewValue } from "@/lib/utils";
import { scanCredentials } from "@/lib/credentials";
import { getConfigHash, loadConfig, patchConfig } from "@/lib/openclaw";

const AUDIT_CACHE_PATH = path.join(process.cwd(), "data", "latest-audit.json");

const severityOrder = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
} as const;

const statusRows = () => {
  const rows = getDb()
    .prepare(
      "SELECT finding_id as findingId, status, fixed_at as fixedAt, dismissed_at as dismissedAt FROM audit_history ORDER BY id DESC",
    )
    .all() as Array<{
      findingId: string;
      status: string;
      fixedAt: string | null;
      dismissedAt: string | null;
    }>;

  return new Map(rows.map((row) => [row.findingId, row]));
};

const withPersistedStatus = (findings: AuditFinding[]) => {
  const map = statusRows();

  return findings.map((finding) => {
    const persisted = map.get(finding.findingId);
    if (!persisted) {
      return finding;
    }

    return {
      ...finding,
      status: persisted.status as AuditFinding["status"],
      appliedAt: persisted.fixedAt,
      dismissedAt: persisted.dismissedAt,
    };
  });
};

export const buildSecurityFindings = async (): Promise<AuditFinding[]> => {
  const config = await loadConfig();
  const gateway = (config.gateway ?? {}) as Record<string, unknown>;
  const gatewayAuth = (gateway.auth ?? {}) as Record<string, unknown>;
  const channels = (config.channels ?? {}) as Record<string, unknown>;
  const plugins = (config.plugins ?? {}) as Record<string, unknown>;
  const credentialScan = await scanCredentials();
  const permissions = await getConfigPermissions();
  const findings: AuditFinding[] = [];

  if (gateway.bind === "0.0.0.0") {
    findings.push({
      findingId: "gateway.bind_no_auth",
      severity: "critical",
      category: "gateway",
      title: "Gateway bound beyond loopback",
      description:
        "The gateway is currently bound to 0.0.0.0. For a personal Tailscale-served deployment, loopback-only binding is safer.",
      currentState: `bind: ${previewValue(gateway.bind)}, token: ${gatewayAuth.token ? "present" : "missing"}`,
      fixType: "auto",
      fixPayload: {
        type: "config_patch",
        patch: {
          gateway: {
            bind: "127.0.0.1",
          },
        },
        expectedOutcome: "Gateway only listens on loopback.",
      },
      docsUrl: "https://tailscale.com/kb/1241/tailscale-serve",
      status: "new",
      appliedAt: null,
      dismissedAt: null,
    });
  }

  if ((permissions & 0o077) !== 0) {
    findings.push({
      findingId: "fs.config.perms_world_readable",
      severity: "critical",
      category: "filesystem",
      title: "Config file is readable by non-owner accounts",
      description:
        "The OpenClaw config should be readable only by the owning user because it contains routing and secret references.",
      currentState: `mode: ${permissions.toString(8)}`,
      fixType: "auto",
      fixPayload: {
        type: "shell_command",
        command: `chmod 600 ${getResolvedPath("config")}`,
        expectedOutcome: "Config becomes owner-readable only.",
      },
      docsUrl: "https://www.man7.org/linux/man-pages/man1/chmod.1.html",
      status: "new",
      appliedAt: null,
      dismissedAt: null,
    });
  }

  if (credentialScan.plaintext.length > 0) {
    findings.push({
      findingId: "credentials.inline_secrets",
      severity: "critical",
      category: "credentials",
      title: "Plaintext credentials detected in config",
      description:
        "One or more model or channel credentials are stored inline instead of using SecretRef providers.",
      currentState: `${credentialScan.plaintext.length} plaintext credential(s) detected`,
      fixType: "manual",
      docsUrl: "https://openclaw.example/docs/secref",
      status: "new",
      appliedAt: null,
      dismissedAt: null,
    });
  }

  const missingAllowFrom = Object.entries(channels).filter(([key, value]) => {
    const channel = value as Record<string, unknown>;
    return (
      Boolean(channel.enabled) &&
      ["telegram", "discord", "whatsapp"].includes(key) &&
      Array.isArray(channel.allowFrom) &&
      channel.allowFrom.length === 0
    );
  });

  if (missingAllowFrom.length > 0) {
    findings.push({
      findingId: "channels.missing_allow_from",
      severity: "high",
      category: "channels",
      title: "Interactive channels do not restrict who can trigger them",
      description:
        "At least one active channel has no allow-list configured. That increases the risk of unwanted commands or noisy usage.",
      currentState: missingAllowFrom.map(([key]) => key).join(", "),
      fixType: "manual",
      docsUrl: "https://openclaw.example/docs/channels",
      status: "new",
      appliedAt: null,
      dismissedAt: null,
    });
  }

  const untrusted = ((plugins.untrusted ?? []) as string[]) || [];
  if (untrusted.length > 0) {
    findings.push({
      findingId: "plugins.untrusted_source",
      severity: "medium",
      category: "plugins",
      title: "Community plugin sources require review",
      description:
        "The config references plugin sources that are not marked trusted. Review provenance before enabling them broadly.",
      currentState: untrusted.join(", "),
      fixType: "manual",
      status: "new",
      appliedAt: null,
      dismissedAt: null,
    });
  }

  const modelProviders = Object.keys((config.models ?? {}) as Record<string, unknown>);
  if (modelProviders.length < 2) {
    findings.push({
      findingId: "models.single_provider",
      severity: "low",
      category: "models",
      title: "Only one model provider configured",
      description:
        "A fallback provider improves resilience when rate limits or upstream incidents occur.",
      currentState: `${modelProviders.length} provider(s) configured`,
      fixType: "manual",
      status: "new",
      appliedAt: null,
      dismissedAt: null,
    });
  }

  return withPersistedStatus(
    findings.sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity]),
  );
};

export const runSecurityAudit = async () => {
  const findings = await buildSecurityFindings();
  await writeJson(AUDIT_CACHE_PATH, {
    timestamp: nowIso(),
    findings,
  });

  return {
    findings,
    status: "completed",
  };
};

export const getLatestFindings = async () => {
  try {
    const raw = await fs.readFile(AUDIT_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as { timestamp: string; findings: AuditFinding[] };
    return {
      timestamp: parsed.timestamp,
      findings: withPersistedStatus(parsed.findings),
    };
  } catch {
    const result = await runSecurityAudit();
    return {
      timestamp: nowIso(),
      findings: result.findings,
    };
  }
};

export const applyFinding = async (findingId: string) => {
  const findings = await buildSecurityFindings();
  const finding = findings.find((entry) => entry.findingId === findingId);

  if (!finding) {
    throw new Error("Finding not found.");
  }

  if (finding.fixType !== "auto" || !finding.fixPayload) {
    throw new Error("This finding requires manual remediation.");
  }

  if (finding.fixPayload.type === "config_patch" && finding.fixPayload.patch) {
    await patchConfig(finding.fixPayload.patch, await getConfigHash());
  }

  if (finding.fixPayload.type === "shell_command" && finding.fixPayload.command) {
    await execRemoteCommand(finding.fixPayload.command);
  }

  getDb()
    .prepare(
      "INSERT INTO audit_history (finding_id, severity, fixed_at, status) VALUES (?, ?, ?, 'applied')",
    )
    .run(findingId, finding.severity, nowIso());

  await runSecurityAudit();

  return {
    status: "applied",
    findingId,
  };
};

export const dismissFinding = async (findingId: string) => {
  const findings = await buildSecurityFindings();
  const finding = findings.find((entry) => entry.findingId === findingId);

  if (!finding) {
    throw new Error("Finding not found.");
  }

  getDb()
    .prepare(
      "INSERT INTO audit_history (finding_id, severity, dismissed_at, status) VALUES (?, ?, ?, 'dismissed')",
    )
    .run(findingId, finding.severity, nowIso());

  await runSecurityAudit();

  return {
    dismissed: true,
    findingId,
  };
};
