import { getDb } from "@/lib/db";
import { buildCurrentSetupMarkdown, loadConfig, saveConfig } from "@/lib/openclaw";
import { writeRemoteFile } from "@/lib/runtime-store";
import { getAppSettings, updateAppSettings } from "@/lib/settings";
import type { SetupAnswers } from "@/lib/types";
import { nowIso, stableStringify } from "@/lib/utils";

const buildHeartbeat = (answers: SetupAnswers) => `# Suggestions Research Heartbeat

## Your Profile
- Role: ${answers.role}
- Devices/Services: ${answers.devicesServices}
- Priority: ${answers.priority}
- Execution policy: ${answers.executionPolicy}
- Off-limits: ${answers.hardLimits}

## Research Mandate
Research what people are automating with AI agents in 2026 and surface only ideas that fit this setup.

## Deduplication & Relevance Filter
- Compare against CURRENT_SETUP.md
- Compare against SUGGESTIONS_HISTORY.md
- Discard ideas that touch off-limits domains

## Output Contract
Write results to SUGGESTIONS.json with ranked, actionable recommendation cards.
`;

const ensureSuggestionsAgent = async () => {
  const config = await loadConfig();
  const agents = ((config.agents as Record<string, unknown> | undefined) ?? {}) as Record<
    string,
    unknown
  >;
  const list = ((agents.list ?? []) as Array<Record<string, unknown>>) || [];

  if (list.some((agent) => agent.id === "suggestions")) {
    return;
  }

  list.push({
    id: "suggestions",
    heartbeat: {
      every: "24h",
      target: "none",
      isolatedSession: true,
      lightContext: true,
      model: "anthropic/claude-opus-4-6",
      prompt:
        "Read HEARTBEAT.md strictly. Research new OpenClaw use cases and write SUGGESTIONS.json.",
    },
  });

  await saveConfig({
    ...config,
    agents: {
      ...agents,
      list,
    },
  });
};

export const getSetupState = () => {
  return {
    onboardingCompleted: getAppSettings().onboardingCompleted,
  };
};

export const completeSetup = async (answers: SetupAnswers) => {
  await writeRemoteFile("heartbeat", buildHeartbeat(answers));
  await writeRemoteFile("currentSetup", await buildCurrentSetupMarkdown(answers));
  await ensureSuggestionsAgent();

  updateAppSettings({
    onboardingCompleted: true,
  });

  getDb()
    .prepare("INSERT INTO setup_snapshots (snapshot_json) VALUES (?)")
    .run(
      stableStringify({
        completedAt: nowIso(),
        answers,
      }),
    );

  return {
    ok: true,
  };
};
