import type { ConfigRecord, CredentialFinding, CredentialProvider } from "@/lib/types";
import { loadConfig, saveConfig } from "@/lib/openclaw";
import {
  flattenEntries,
  humanizeKey,
  isSecretLike,
  previewValue,
  redactSecret,
  setAtPath,
} from "@/lib/utils";

const detectType = (keyPath: string, value: string) => {
  if (value.startsWith("sk-ant-")) {
    return "anthropic_key";
  }

  if (value.startsWith("sk-")) {
    return "openai_key";
  }

  if (value.startsWith("ghp_")) {
    return "github_token";
  }

  if (/^\d+:[A-Za-z0-9_-]+$/.test(value)) {
    return "telegram_token";
  }

  if (keyPath.toLowerCase().includes("webhook")) {
    return "webhook_secret";
  }

  return "generic_secret";
};

const suggestedRefId = (keyPath: string) =>
  keyPath
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toUpperCase();

const buildReference = (provider: CredentialProvider, refId: string) => {
  if (provider === "file") {
    return `$file:/run/secrets/${refId.toLowerCase()}`;
  }

  if (provider === "exec") {
    return `$exec:pass ${refId.toLowerCase()}`;
  }

  return `$env:${refId}`;
};

const buildPatchPayload = (keyPath: string, value: string) => {
  const segments = keyPath.split(".");
  return segments
    .reverse()
    .reduce<Record<string, unknown>>((acc, segment, index) => {
      if (index === 0) {
        return { [segment]: value };
      }

      return { [segment]: acc };
    }, {});
};

const toCredentialFinding = (config: ConfigRecord, keyPath: string, value: string): CredentialFinding => {
  const refId = suggestedRefId(keyPath);
  return {
    credentialId: keyPath,
    keyPath,
    detectedType: detectType(keyPath, value),
    currentState: "plaintext",
    suggestedProvider: "env",
    suggestedRefId: refId,
    migrationSteps: [
      `Create the secret source for ${humanizeKey(keyPath)}.`,
      `Set ${refId} in your chosen provider.`,
      `Patch ${keyPath} to ${buildReference("env", refId)}.`,
      "Re-run the credentials scan to verify the migration.",
    ],
    patchPayload: buildPatchPayload(keyPath, buildReference("env", refId)),
    currentValuePreview: redactSecret(value),
    status: "new",
  };
};

export const scanCredentials = async () => {
  const config = await loadConfig();
  const entries = flattenEntries(config);

  const plaintext = entries
    .filter((entry) => typeof entry.value === "string" && isSecretLike(entry.path, entry.value))
    .map((entry) => toCredentialFinding(config, entry.path, String(entry.value)));

  const secured = entries
    .filter(
      (entry) =>
        typeof entry.value === "string" &&
        (entry.value.startsWith("$env:") ||
          entry.value.startsWith("$file:") ||
          entry.value.startsWith("$exec:")),
    )
    .map((entry) => ({
      keyPath: entry.path,
      valuePreview: previewValue(entry.value),
    }));

  return {
    plaintext,
    secured,
  };
};

export const migrateCredential = async (input: {
  keyPath: string;
  provider: CredentialProvider;
  refId: string;
}) => {
  const config = await loadConfig();
  const existing = flattenEntries(config).find((entry) => entry.path === input.keyPath);

  if (!existing || typeof existing.value !== "string") {
    throw new Error("Credential path not found.");
  }

  const reference = buildReference(input.provider, input.refId);
  const nextConfig = setAtPath(config, input.keyPath, reference);

  await saveConfig(nextConfig);

  return {
    status: "migrated",
    patch: buildPatchPayload(input.keyPath, reference),
  };
};
