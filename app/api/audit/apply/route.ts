import { NextRequest, NextResponse } from "next/server";

import { applyFinding } from "@/lib/audit";
import { jsonError } from "@/lib/api-responses";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { findingId?: string };
    if (!body.findingId) {
      return NextResponse.json({ error: "findingId is required" }, { status: 400 });
    }

    return NextResponse.json(await applyFinding(body.findingId));
  } catch (error) {
    return jsonError(error);
  }
}
