import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { refreshSuggestions } from "@/lib/suggestions";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json(await refreshSuggestions());
  } catch (error) {
    return jsonError(error);
  }
}
