import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { patchConfig } from "@/lib/openclaw";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      patch?: Record<string, unknown>;
      baseHash?: string;
    };

    if (!body.patch) {
      return NextResponse.json({ error: "patch is required" }, { status: 400 });
    }

    return NextResponse.json(await patchConfig(body.patch, body.baseHash));
  } catch (error) {
    return jsonError(error);
  }
}
