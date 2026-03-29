import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { applySuggestion } from "@/lib/suggestions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: string;
      confirmExecution?: boolean;
      payloadText?: string;
      baseHash?: string;
    };

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    return NextResponse.json(
      await applySuggestion({
        id: body.id,
        confirmExecution: body.confirmExecution,
        payloadText: body.payloadText,
        baseHash: body.baseHash,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
