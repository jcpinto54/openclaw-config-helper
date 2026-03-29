import { getDb } from "@/lib/db";
import { getAvailableModels, getGatewayStatus } from "@/lib/openclaw";
import { previewSuggestion } from "@/lib/suggestions";
import type {
  SuggestionPreview,
  SuggestionReviewMessage,
  SuggestionReviewMessageRole,
  SuggestionReviewThread,
} from "@/lib/types";
import { stableStringify } from "@/lib/utils";

const insertMessage = (input: {
  suggestionId: string;
  role: SuggestionReviewMessageRole;
  content: string;
  model?: string | null;
  proposedPayloadText?: string | null;
}) => {
  getDb()
    .prepare(
      "INSERT INTO suggestion_review_messages (suggestion_id, role, content, model, proposed_payload_text) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      input.suggestionId,
      input.role,
      input.content,
      input.model ?? null,
      input.proposedPayloadText ?? null,
    );
};

const listMessages = (suggestionId: string) => {
  return getDb()
    .prepare(
      "SELECT id, suggestion_id as suggestionId, role, content, model, proposed_payload_text as proposedPayloadText, created_at as createdAt FROM suggestion_review_messages WHERE suggestion_id = ? ORDER BY id ASC",
    )
    .all(suggestionId) as SuggestionReviewMessage[];
};

const getThreadRow = (suggestionId: string) => {
  return getDb()
    .prepare(
      "SELECT suggestion_id as suggestionId, selected_model as selectedModel FROM suggestion_review_threads WHERE suggestion_id = ?",
    )
    .get(suggestionId) as { suggestionId: string; selectedModel: string } | undefined;
};

const persistThreadModel = (suggestionId: string, selectedModel: string) => {
  getDb()
    .prepare(
      "INSERT INTO suggestion_review_threads (suggestion_id, selected_model, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(suggestion_id) DO UPDATE SET selected_model = excluded.selected_model, updated_at = CURRENT_TIMESTAMP",
    )
    .run(suggestionId, selectedModel);
};

const ensureAvailableModel = async (selectedModel?: string) => {
  const availableModels = await getAvailableModels();
  const gateway = await getGatewayStatus();
  const fallbackModel = gateway.model || availableModels[0] || "anthropic/claude-opus-4-6";

  if (!selectedModel) {
    return {
      selectedModel: availableModels.includes(fallbackModel)
        ? fallbackModel
        : (availableModels[0] ?? fallbackModel),
      availableModels:
        availableModels.length > 0
          ? availableModels
          : [fallbackModel],
    };
  }

  if (!availableModels.includes(selectedModel)) {
    throw new Error(`Selected model "${selectedModel}" is not currently available.`);
  }

  return {
    selectedModel,
    availableModels,
  };
};

const ensureThread = async (suggestionId: string) => {
  const existing = getThreadRow(suggestionId);
  const availability = await ensureAvailableModel(existing?.selectedModel);

  if (!existing) {
    persistThreadModel(suggestionId, availability.selectedModel);
    insertMessage({
      suggestionId,
      role: "system",
      content: `Review thread started. Session model set to ${availability.selectedModel}.`,
      model: availability.selectedModel,
    });
  } else if (existing.selectedModel !== availability.selectedModel) {
    persistThreadModel(suggestionId, availability.selectedModel);
  }

  return availability;
};

const extractJsonBlock = (content: string) => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const objectStart = content.indexOf("{");
  const objectEnd = content.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return content.slice(objectStart, objectEnd + 1).trim();
  }

  return null;
};

const maybeReplaceByInstruction = (payloadText: string, message: string) => {
  const patterns = [
    /replace\s+["']?([^"']+?)["']?\s+with\s+["']?([^"']+?)["']?(?:[.!?]|$)/i,
    /use\s+["']?([^"']+?)["']?\s+instead\s+of\s+["']?([^"']+?)["']?(?:[.!?]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match) {
      continue;
    }

    const from = pattern === patterns[0] ? match[1] : match[2];
    const to = pattern === patterns[0] ? match[2] : match[1];
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const replaced = payloadText.replace(new RegExp(escaped, "gi"), to);

    if (replaced !== payloadText) {
      return {
        proposedPayloadText: replaced,
        note: `I replaced "${from}" with "${to}" in the reviewed payload draft.`,
      };
    }
  }

  if (message.toLowerCase().includes("127.0.0.1") && payloadText.includes("0.0.0.0")) {
    return {
      proposedPayloadText: payloadText.replace(/0\.0\.0\.0/g, "127.0.0.1"),
      note: "I updated the bind target from 0.0.0.0 to 127.0.0.1 in the draft.",
    };
  }

  return null;
};

const explainPreview = (preview: SuggestionPreview) => {
  if (preview.diff.length === 0) {
    return `${preview.summary} ${preview.impact}`;
  }

  const changeList = preview.diff
    .slice(0, 5)
    .map((entry) => `- ${entry.path}: ${entry.before} -> ${entry.after}`)
    .join("\n");

  return [
    preview.summary,
    preview.impact,
    "Current detected changes:",
    changeList,
    preview.diff.length > 5 ? `- ...and ${preview.diff.length - 5} more` : null,
  ]
    .filter(Boolean)
    .join("\n");
};

const buildAssistantReply = async (input: {
  preview: SuggestionPreview;
  selectedModel: string;
  userMessage: string;
  draftPayload: string;
}) => {
  const normalized = input.userMessage.trim().toLowerCase();
  const jsonBlock = extractJsonBlock(input.userMessage);
  let proposedPayloadText: string | null = null;
  const responseParts: string[] = [];

  responseParts.push(`Review session model: ${input.selectedModel}.`);

  if (
    /(what|explain|walk me through|summari[sz]e|how will this|what will this|why)/i.test(
      input.userMessage,
    )
  ) {
    responseParts.push(explainPreview(input.preview));
  }

  if (jsonBlock && input.preview.payloadFormat === "json") {
    try {
      proposedPayloadText = stableStringify(JSON.parse(jsonBlock));
      responseParts.push(
        "I parsed the JSON you provided and prepared it as a new candidate config patch draft.",
      );
    } catch {
      responseParts.push(
        "I found a JSON-looking block in your message, but it was not valid JSON. The current draft remains unchanged.",
      );
    }
  }

  if (!proposedPayloadText) {
    const replacement = maybeReplaceByInstruction(input.draftPayload, input.userMessage);
    if (replacement) {
      proposedPayloadText = replacement.proposedPayloadText;
      responseParts.push(replacement.note);
    }
  }

  if (!proposedPayloadText && input.preview.payloadFormat === "text") {
    if (/(rewrite|change|adjust|update|make|refine|tweak)/i.test(input.userMessage)) {
      proposedPayloadText = `${input.draftPayload.trim()}\n\nRefinement requested in review thread:\n- ${input.userMessage.trim()}`;
      responseParts.push(
        "I turned your request into an updated prompt draft. Review it, then revalidate before apply.",
      );
    }
  }

  if (!proposedPayloadText && input.preview.payloadFormat === "shell") {
    if (jsonBlock) {
      proposedPayloadText = jsonBlock;
      responseParts.push(
        "I used the code block from your message as the proposed command payload. Review it carefully before execution.",
      );
    } else if (/(replace|change|update|set|use)\b/i.test(normalized)) {
      responseParts.push(
        "For shell suggestions, I can track your requested change, but the safest path is to paste the exact command you want into the payload editor or send it here in a code block.",
      );
    }
  }

  if (!proposedPayloadText && responseParts.length === 1) {
    responseParts.push(
      "I can help iterate on this suggestion. Ask me to explain the impact, replace values in the draft, or paste a revised payload and I will turn it into a proposed draft for revalidation.",
    );
  }

  if (proposedPayloadText === input.draftPayload) {
    proposedPayloadText = null;
  }

  return {
    content: responseParts.join("\n\n"),
    proposedPayloadText,
  };
};

export const getSuggestionReviewThread = async (
  suggestionId: string,
): Promise<SuggestionReviewThread> => {
  const availability = await ensureThread(suggestionId);

  return {
    suggestionId,
    selectedModel: availability.selectedModel,
    availableModels: availability.availableModels,
    messages: listMessages(suggestionId),
  };
};

export const updateSuggestionReviewModel = async (input: {
  suggestionId: string;
  selectedModel: string;
}) => {
  const current = await getSuggestionReviewThread(input.suggestionId);
  if (current.selectedModel === input.selectedModel) {
    return current;
  }

  const availability = await ensureAvailableModel(input.selectedModel);
  persistThreadModel(input.suggestionId, availability.selectedModel);
  insertMessage({
    suggestionId: input.suggestionId,
    role: "system",
    content: `Switched review session model to ${availability.selectedModel}.`,
    model: availability.selectedModel,
  });

  return getSuggestionReviewThread(input.suggestionId);
};

export const sendSuggestionReviewMessage = async (input: {
  suggestionId: string;
  content: string;
  draftPayload: string;
  selectedModel: string;
}) => {
  const trimmed = input.content.trim();
  if (!trimmed) {
    throw new Error("Message cannot be empty.");
  }

  const thread = await updateSuggestionReviewModel({
    suggestionId: input.suggestionId,
    selectedModel: input.selectedModel,
  });

  insertMessage({
    suggestionId: input.suggestionId,
    role: "user",
    content: trimmed,
    model: thread.selectedModel,
  });

  const preview = await previewSuggestion({
    id: input.suggestionId,
    payloadText: input.draftPayload,
  });
  const assistantReply = await buildAssistantReply({
    preview,
    selectedModel: thread.selectedModel,
    userMessage: trimmed,
    draftPayload: input.draftPayload,
  });

  insertMessage({
    suggestionId: input.suggestionId,
    role: "assistant",
    content: assistantReply.content,
    model: thread.selectedModel,
    proposedPayloadText: assistantReply.proposedPayloadText,
  });

  return getSuggestionReviewThread(input.suggestionId);
};
