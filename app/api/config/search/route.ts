import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { searchConfig } from "@/lib/openclaw";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const section = request.nextUrl.searchParams.get("section") ?? undefined;

    return NextResponse.json({
      results: await searchConfig(query, section),
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}
