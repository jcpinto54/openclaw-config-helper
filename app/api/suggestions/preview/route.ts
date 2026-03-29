import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { previewSuggestion } from "@/lib/suggestions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: string;
      payloadText?: string;
    };

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    return NextResponse.json(
      await previewSuggestion({
        id: body.id,
        payloadText: body.payloadText,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
