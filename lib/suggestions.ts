import { getDb } from "@/lib/db";
import { getConfigHash, getInstalledSkills, loadConfig, patchConfig } from "@/lib/openclaw";
import {
  appendRemoteFile,
  execRemoteCommand,
  readRemoteFile,
  writeRemoteFile,
} from "@/lib/runtime-store";
import type {
  SuggestionPayloadType,
  SuggestionPreview,
  Suggestion,
  SuggestionHistoryEntry,
  SuggestionStatus,
  SuggestionValidationCheck,
} from "@/lib/types";
import {
  deepMerge,
  flattenEntries,
  getAtPath,
  isPlainObject,
  nowIso,
  previewValue,
  stableStringify,
} from "@/lib/utils";

type SuggestionsDocument = {
  timestamp: string;
  suggestions: Array<Omit<Suggestion, "status"> & { status?: SuggestionStatus }>;
};

const latestStatuses = () => {
  const activity = getDb()
    .prepare(
      "SELECT suggestion_id as suggestionId, status, created_at as createdAt FROM suggestion_activity ORDER BY id DESC",
    )
    .all() as Array<{ suggestionId: string; status: SuggestionStatus; createdAt: string }>;

  const map = new Map<string, SuggestionStatus>();
  for (const row of activity) {
    if (!map.has(row.suggestionId)) {
      map.set(row.suggestionId, row.status);
    }
  }

  return map;
};

const loadSuggestionsDocument = async (): Promise<SuggestionsDocument> => {
  const raw = await readRemoteFile("suggestions");
  return JSON.parse(raw) as SuggestionsDocument;
};

const saveSuggestionsDocument = async (document: SuggestionsDocument) => {
  await writeRemoteFile("suggestions", `${JSON.stringify(document, null, 2)}\n`);
};

const formatPayloadText = (
  payloadType: SuggestionPayloadType,
  payload: string | Record<string, unknown>,
) => {
  if (payloadType === "config.patch") {
    const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!isPlainObject(parsed)) {
      throw new Error("Config patch payload must resolve to a JSON object.");
    }

    return stableStringify(parsed);
  }

  if (typeof payload === "string") {
    return payload;
  }

  return stableStringify(payload);
};

const parsePayloadText = (
  payloadType: SuggestionPayloadType,
  payloadText: string,
): string | Record<string, unknown> => {
  if (payloadType === "config.patch") {
    const parsed = JSON.parse(payloadText) as unknown;
    if (!isPlainObject(parsed)) {
      throw new Error("Config patch payload must be a JSON object.");
    }

    return parsed;
  }

  return payloadText;
};

const hasFailedValidation = (validation: SuggestionValidationCheck[]) =>
  validation.some((entry) => entry.status === "fail");

const buildRequirementChecks = (
  missingRequirements: string[],
): SuggestionValidationCheck[] => {
  if (missingRequirements.length === 0) {
    return [
      {
        id: "requirements",
        label: "Requirements",
        status: "pass" as const,
        detail: "All declared requirements appear to be installed.",
      },
    ];
  }

  return [
    {
      id: "requirements",
      label: "Requirements",
      status: "fail" as const,
      detail: `Missing required setup: ${missingRequirements.join(", ")}.`,
    },
  ];
};

const buildPatchDiff = async (patch: Record<string, unknown>) => {
  const currentConfig = await loadConfig();
  const nextConfig = deepMerge(currentConfig, patch);
  const diff = flattenEntries(patch)
    .filter((entry) => entry.path)
    .map((entry) => ({
      path: entry.path,
      before: previewValue(getAtPath(currentConfig, entry.path)),
      after: previewValue(getAtPath(nextConfig, entry.path)),
    }));

  return {
    diff,
    affectedPaths: diff.map((entry) => entry.path),
  };
};

const activityLog = (
  suggestion: Suggestion,
  status: SuggestionStatus,
  action: string,
) => {
  getDb()
    .prepare(
      "INSERT INTO suggestion_activity (suggestion_id, title, category, status, action) VALUES (?, ?, ?, ?, ?)",
    )
    .run(suggestion.id, suggestion.title, suggestion.category, status, action);
};

const appendHistoryRow = async (
  suggestion: Suggestion,
  status: SuggestionStatus,
  action: string,
) => {
  await appendRemoteFile(
    "suggestionsHistory",
    `| ${new Date().toISOString().replace("T", " ").slice(0, 16)} | ${suggestion.id} | ${suggestion.title} | ${suggestion.category} | ${status} | ${action} |\n`,
  );
};

const hydrateSuggestion = async (
  suggestion: Omit<Suggestion, "status"> & { status?: SuggestionStatus },
): Promise<Suggestion> => {
  const statusMap = latestStatuses();
  const installedSkills = await getInstalledSkills();
  const missingRequirements = (suggestion.requires ?? []).filter(
    (item) => !installedSkills.includes(item),
  );

  const latestStatus = statusMap.get(suggestion.id) ?? suggestion.status ?? "new";

  return {
    ...suggestion,
    status: missingRequirements.length > 0 ? "requires_setup" : latestStatus,
    updatedAt: nowIso(),
  };
};

const findSuggestion = async (id: string) => {
  const document = await loadSuggestionsDocument();
  const entry = document.suggestions.find((suggestion) => suggestion.id === id);

  if (!entry) {
    const saved = getDb()
      .prepare("SELECT payload_json as payloadJson FROM saved_suggestions WHERE id = ?")
      .get(id) as { payloadJson: string } | undefined;

    if (!saved) {
      throw new Error("Suggestion not found.");
    }

    return JSON.parse(saved.payloadJson) as Suggestion;
  }

  return hydrateSuggestion(entry);
};

export const previewSuggestion = async (input: {
  id: string;
  payloadText?: string;
}): Promise<SuggestionPreview> => {
  const suggestion = await findSuggestion(input.id);
  const installedSkills = await getInstalledSkills();
  const missingRequirements = (suggestion.requires ?? []).filter(
    (item) => !installedSkills.includes(item),
  );
  const exactPayload =
    input.payloadText ?? formatPayloadText(suggestion.payload_type, suggestion.payload);

  const validation: SuggestionValidationCheck[] = buildRequirementChecks(
    missingRequirements,
  );

  if (suggestion.payload_type === "prompt") {
    validation.push({
      id: "prompt-non-empty",
      label: "Prompt body",
      status: exactPayload.trim() ? "pass" : "fail",
      detail: exactPayload.trim()
        ? "The exact prompt below will be queued as reviewed prompt text."
        : "Prompt text cannot be empty.",
    });

    return {
      suggestion,
      target: "Suggestions workflow prompt",
      exactPayload,
      payloadFormat: "text",
      summary: "The reviewed prompt text below is the exact message payload associated with this suggestion.",
      impact:
        "This does not patch config directly. Review the text carefully so the intended OpenClaw follow-up is explicit.",
      editable: true,
      requiresConfirmation: true,
      affectedPaths: [],
      missingRequirements,
      validation,
      diff: [],
    };
  }

  if (suggestion.payload_type === "shell_command") {
    validation.push({
      id: "command-non-empty",
      label: "Command text",
      status: exactPayload.trim() ? "pass" : "fail",
      detail: exactPayload.trim()
        ? "The exact shell command below will be executed remotely over SSH."
        : "Shell command cannot be empty.",
    });
    validation.push({
      id: "command-warning",
      label: "Remote execution",
      status: "warn",
      detail: "Shell suggestions run directly on the remote host and should be reviewed carefully.",
    });

    return {
      suggestion,
      target: "Remote shell over SSH",
      exactPayload,
      payloadFormat: "shell",
      summary: "Confirm the exact remote command before applying this suggestion.",
      impact: "This may mutate the remote OpenClaw environment immediately.",
      editable: true,
      requiresConfirmation: true,
      affectedPaths: [],
      missingRequirements,
      validation,
      diff: [],
    };
  }

  const parsedPatch = parsePayloadText("config.patch", exactPayload) as Record<string, unknown>;
  const { diff, affectedPaths } = await buildPatchDiff(parsedPatch);
  const currentConfigHash = await getConfigHash();

  validation.push({
    id: "patch-shape",
    label: "Patch format",
    status: Object.keys(parsedPatch).length > 0 ? "pass" : "fail",
    detail:
      Object.keys(parsedPatch).length > 0
        ? "The payload is valid JSON and can be sent as a config patch."
        : "Config patch cannot be empty.",
  });
  validation.push({
    id: "patch-diff",
    label: "Detected changes",
    status: diff.length > 0 ? "pass" : "warn",
    detail:
      diff.length > 0
        ? `${diff.length} config value(s) would change.`
        : "No leaf-level value changes were detected from the current payload.",
  });
  validation.push({
    id: "base-hash",
    label: "Current config snapshot",
    status: "pass",
    detail: `Preview captured against config hash ${currentConfigHash}.`,
  });

  return {
    suggestion,
    target: "OpenClaw config.patch",
    exactPayload,
    payloadFormat: "json",
    summary: "The exact JSON patch below will be merged into the live OpenClaw config if you confirm.",
    impact:
      affectedPaths.length > 0
        ? `Affected config paths: ${affectedPaths.join(", ")}`
        : "No affected config paths were detected.",
    editable: true,
    requiresConfirmation: true,
    currentConfigHash,
    affectedPaths,
    missingRequirements,
    validation,
    diff,
  };
};

export const listSuggestions = async (state?: SuggestionStatus) => {
  const document = await loadSuggestionsDocument();
  const active = await Promise.all(document.suggestions.map((item) => hydrateSuggestion(item)));

  const savedRows = getDb()
    .prepare("SELECT payload_json as payloadJson FROM saved_suggestions ORDER BY saved_at DESC")
    .all() as Array<{ payloadJson: string }>;

  const saved = savedRows
    .map((row) => JSON.parse(row.payloadJson) as Suggestion)
    .filter((item) => !active.some((existing) => existing.id === item.id))
    .map((item) => ({
      ...item,
      status: "saved" as const,
    }));

  const combined = [...active, ...saved];

  const visible = state
    ? combined.filter((item) => item.status === state)
    : combined.filter((item) => item.status !== "dismissed");

  return {
    timestamp: document.timestamp,
    suggestions: visible,
  };
};

export const saveSuggestion = async (id: string) => {
  const suggestion = await findSuggestion(id);

  getDb()
    .prepare(
      "INSERT INTO saved_suggestions (id, title, category, payload_json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, category = excluded.category, payload_json = excluded.payload_json, saved_at = CURRENT_TIMESTAMP",
    )
    .run(id, suggestion.title, suggestion.category, JSON.stringify({ ...suggestion, status: "saved" }));

  activityLog(suggestion, "saved", "Saved for later");
  await appendHistoryRow(suggestion, "saved", "Saved for later");

  return {
    saved: true,
    savedAt: nowIso(),
  };
};

export const dismissSuggestion = async (id: string) => {
  const suggestion = await findSuggestion(id);

  getDb()
    .prepare(
      "INSERT INTO dismissed_suggestions (id, reason) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET dismissed_at = CURRENT_TIMESTAMP, reason = excluded.reason",
    )
    .run(id, "Dismissed from the webapp");

  activityLog(suggestion, "dismissed", "Dismissed");
  await appendHistoryRow(suggestion, "dismissed", "Dismissed");

  return {
    dismissed: true,
  };
};

export const applySuggestion = async (input: {
  id: string;
  confirmExecution?: boolean;
  payloadText?: string;
  baseHash?: string;
}) => {
  const preview = await previewSuggestion({
    id: input.id,
    payloadText: input.payloadText,
  });

  if (hasFailedValidation(preview.validation)) {
    throw new Error("Review checks failed. Resolve the highlighted issues before applying.");
  }

  let result = "Applied";

  if (preview.suggestion.payload_type === "prompt") {
    result = "Reviewed prompt payload queued for the suggestions workflow.";
  }

  if (preview.suggestion.payload_type === "config.patch") {
    if (!input.baseHash) {
      throw new Error("Config patch apply requires a reviewed base hash.");
    }

    const patch = parsePayloadText(
      "config.patch",
      preview.exactPayload,
    ) as Record<string, unknown>;

    await patchConfig(patch, input.baseHash);
    result = "Config patch applied.";
  }

  if (preview.suggestion.payload_type === "shell_command") {
    if (!input.confirmExecution) {
      throw new Error("Shell-command suggestions require explicit confirmation.");
    }

    const execResult = await execRemoteCommand(preview.exactPayload);
    result = execResult.stdout.trim() || "Shell command executed.";
  }

  getDb()
    .prepare(
      "UPDATE saved_suggestions SET applied_at = CURRENT_TIMESTAMP, apply_count = apply_count + 1 WHERE id = ?",
    )
    .run(input.id);

  activityLog(preview.suggestion, "applied", result);
  await appendHistoryRow(preview.suggestion, "applied", result);

  return {
    status: "applied",
    result,
    exactPayload: preview.exactPayload,
  };
};

export const refreshSuggestions = async () => {
  await execRemoteCommand('openclaw system event --text "Refresh suggestions now" --mode now');
  const document = await loadSuggestionsDocument();
  document.timestamp = nowIso();
  await saveSuggestionsDocument(document);

  return {
    status: "triggered",
    nextRefresh: document.timestamp,
  };
};

export const getSuggestionHistory = () => {
  const rows = getDb()
    .prepare(
      "SELECT id, suggestion_id as suggestionId, title, category, status, action, created_at as createdAt FROM suggestion_activity ORDER BY id DESC LIMIT 100",
    )
    .all() as SuggestionHistoryEntry[];

  return {
    history: rows,
  };
};
