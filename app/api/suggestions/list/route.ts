import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { listSuggestions } from "@/lib/suggestions";
import type { SuggestionStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const state = (request.nextUrl.searchParams.get("state") ?? undefined) as
      | SuggestionStatus
      | undefined;

    return NextResponse.json(await listSuggestions(state));
  } catch (error) {
    return jsonError(error, 500);
  }
}
