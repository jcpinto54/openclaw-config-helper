import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { getSuggestionHistory } from "@/lib/suggestions";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(getSuggestionHistory());
  } catch (error) {
    return jsonError(error);
  }
}
