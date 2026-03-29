import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { updateSuggestionReviewModel } from "@/lib/suggestion-review";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      suggestionId?: string;
      selectedModel?: string;
    };

    if (!body.suggestionId || !body.selectedModel) {
      return NextResponse.json(
        { error: "suggestionId and selectedModel are required" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await updateSuggestionReviewModel({
        suggestionId: body.suggestionId,
        selectedModel: body.selectedModel,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
