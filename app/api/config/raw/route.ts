import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { getConfigHash, loadRedactedConfig } from "@/lib/openclaw";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({
      config: await loadRedactedConfig(),
      hash: await getConfigHash(),
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}
