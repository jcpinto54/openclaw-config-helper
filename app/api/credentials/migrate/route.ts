import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { migrateCredential } from "@/lib/credentials";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      keyPath?: string;
      provider?: "env" | "file" | "exec";
      refId?: string;
    };

    if (!body.keyPath || !body.provider || !body.refId) {
      return NextResponse.json(
        { error: "keyPath, provider, and refId are required" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await migrateCredential({
        keyPath: body.keyPath,
        provider: body.provider,
        refId: body.refId,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
