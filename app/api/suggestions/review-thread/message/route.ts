import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { sendSuggestionReviewMessage } from "@/lib/suggestion-review";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      suggestionId?: string;
      content?: string;
      draftPayload?: string;
      selectedModel?: string;
    };

    if (!body.suggestionId || !body.content || !body.draftPayload || !body.selectedModel) {
      return NextResponse.json(
        { error: "suggestionId, content, draftPayload, and selectedModel are required" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await sendSuggestionReviewMessage({
        suggestionId: body.suggestionId,
        content: body.content,
        draftPayload: body.draftPayload,
        selectedModel: body.selectedModel,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
