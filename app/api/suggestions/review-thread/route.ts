import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { getSuggestionReviewThread } from "@/lib/suggestion-review";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const suggestionId = request.nextUrl.searchParams.get("suggestionId");

    if (!suggestionId) {
      return NextResponse.json({ error: "suggestionId is required" }, { status: 400 });
    }

    return NextResponse.json(await getSuggestionReviewThread(suggestionId));
  } catch (error) {
    return jsonError(error);
  }
}
