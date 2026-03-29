import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { completeSetup } from "@/lib/setup";
import type { SetupAnswers } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<SetupAnswers>;
    const requiredFields = [
      "role",
      "devicesServices",
      "priority",
      "executionPolicy",
      "hardLimits",
    ] as const;

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    return NextResponse.json(await completeSetup(body as SetupAnswers));
  } catch (error) {
    return jsonError(error);
  }
}
