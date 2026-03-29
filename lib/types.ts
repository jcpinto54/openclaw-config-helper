export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ConfigRecord = Record<string, unknown>;

export type HealthStatus = "ok" | "warning" | "error";

export type ExplainedSection = {
  key: string;
  title: string;
  path: string;
  summary: string;
  description: string;
  status: HealthStatus;
  data: unknown;
};

export type ConfigSearchResult = {
  path: string;
  section: string;
  valuePreview: string;
  note: string;
};

export type AuditSeverity = "critical" | "high" | "medium" | "low";
export type FindingStatus = "new" | "applied" | "dismissed" | "pending";

export type AuditFinding = {
  findingId: string;
  severity: AuditSeverity;
  category: string;
  title: string;
  description: string;
  currentState: string;
  fixType: "auto" | "manual";
  fixPayload?: {
    type: "config_patch" | "shell_command";
    patch?: Record<string, unknown>;
    command?: string;
    expectedOutcome: string;
  };
  docsUrl?: string;
  status: FindingStatus;
  appliedAt: string | null;
  dismissedAt: string | null;
};

export type CredentialProvider = "env" | "file" | "exec";

export type CredentialFinding = {
  credentialId: string;
  keyPath: string;
  detectedType: string;
  currentState: "plaintext" | "secured";
  suggestedProvider: CredentialProvider;
  suggestedRefId: string;
  migrationSteps: string[];
  patchPayload: Record<string, unknown>;
  currentValuePreview: string;
  status: "new" | "migrated";
};

export type SuggestionStatus =
  | "new"
  | "saved"
  | "applied"
  | "dismissed"
  | "requires_setup";

export type SuggestionPayloadType = "prompt" | "config.patch" | "shell_command";

export type Suggestion = {
  id: string;
  title: string;
  category: string;
  why_relevant: string;
  complexity: "Low" | "Medium" | "High";
  payload_type: SuggestionPayloadType;
  payload: string | Record<string, unknown>;
  source_url?: string;
  requires?: string[];
  status: SuggestionStatus;
  updatedAt?: string;
};

export type SuggestionValidationStatus = "pass" | "warn" | "fail";

export type SuggestionValidationCheck = {
  id: string;
  label: string;
  status: SuggestionValidationStatus;
  detail: string;
};

export type SuggestionDiffEntry = {
  path: string;
  before: string;
  after: string;
};

export type SuggestionPreview = {
  suggestion: Suggestion;
  target: string;
  exactPayload: string;
  payloadFormat: "text" | "json" | "shell";
  summary: string;
  impact: string;
  editable: boolean;
  requiresConfirmation: boolean;
  currentConfigHash?: string;
  affectedPaths: string[];
  missingRequirements: string[];
  validation: SuggestionValidationCheck[];
  diff: SuggestionDiffEntry[];
};

export type SuggestionHistoryEntry = {
  id: number;
  suggestionId: string;
  title: string;
  category: string;
  status: SuggestionStatus | "pending";
  action: string;
  createdAt: string;
};

export type GatewayStatus = {
  status: "running" | "degraded" | "offline";
  mode: "mock" | "ssh" | "gateway";
  hash: string;
  model: string;
  agents: string[];
  updatedAt: string;
};

export type SetupAnswers = {
  role: string;
  devicesServices: string;
  priority: string;
  executionPolicy: string;
  hardLimits: string;
};

export type AppSettings = {
  refreshFrequency: string;
  notifyOnCritical: boolean;
  theme: "system" | "light" | "dark";
  onboardingCompleted: boolean;
};
