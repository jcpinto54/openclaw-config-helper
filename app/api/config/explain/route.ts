import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { explainConfig } from "@/lib/openclaw";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({
      sections: await explainConfig(),
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}
