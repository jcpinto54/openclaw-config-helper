import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { dismissSuggestion } from "@/lib/suggestions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    return NextResponse.json(await dismissSuggestion(body.id));
  } catch (error) {
    return jsonError(error);
  }
}
